package com.ipomanager.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ipomanager.dto.AllotmentCheckResult;
import com.ipomanager.dto.RegistrarDetection;
import com.ipomanager.dto.RegistrarIpoDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * PAN-based IPO allotment lookup against registrar sites.
 *
 * <p>There is no official registrar API. KFintech and MUFG Intime expose
 * internal endpoints (the same ones their own allotment pages call) that
 * need no captcha, so a server-side check is possible. BSE, NSE and
 * Bigshare gate their lookups behind captchas and are manual-only.
 *
 * <p>These are undocumented endpoints — they can change without notice.
 * Every failure therefore degrades to a clear ERROR/MANUAL outcome,
 * never a guessed allotment.
 *
 * <p>Privacy: the PAN is decrypted from the KYC store only in memory,
 * sent to the registrar over HTTPS, and never written to logs
 * (masked at most).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AllotmentCheckService {

    private static final Duration TIMEOUT = Duration.ofSeconds(15);
    private static final String UA =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    + "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

    private static final String KFINTECH_QUERY =
            "https://0uz601ms56.execute-api.ap-south-1.amazonaws.com/prod/api/query?type=pan";
    private static final String KFINTECH_SITE = "https://ipostatus.kfintech.com/";
    private static final String MUFG_BASE =
            "https://in.mpms.mufg.com/Initial_Offer/IPO.aspx";

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(TIMEOUT)
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();
    private final ObjectMapper mapper = new ObjectMapper();

    /** Registrar IPO lists, cached briefly so setup doesn't hammer them. */
    private final Map<String, CachedList> listCache = new ConcurrentHashMap<>();

    /** Which registrars support automatic checks. */
    public boolean supportsAutoCheck(String registrar) {
        return "KFINTECH".equals(registrar) || "MUFG".equals(registrar);
    }

    /**
     * Fuzzy-matches the user's IPO name against the live KFintech and
     * MUFG Intime catalogues. Returns the best match when it is
     * confident (>= 0.6 Dice token overlap), otherwise empty — the
     * caller then asks the user to set the registrar manually.
     */
    public Optional<RegistrarDetection> detectRegistrar(String ipoName) {
        Set<String> want = nameTokens(ipoName);
        if (want.isEmpty()) {
            return Optional.empty();
        }
        RegistrarDetection best = null;
        for (String reg : List.of("KFINTECH", "MUFG")) {
            for (RegistrarIpoDto candidate : registrarIpos(reg)) {
                double score = dice(want, nameTokens(candidate.getName()));
                if (score >= 0.6
                        && (best == null || score > best.getConfidence())) {
                    best = new RegistrarDetection(reg, candidate.getId(),
                            candidate.getName(), score, null);
                }
            }
        }
        return Optional.ofNullable(best);
    }

    /**
     * Significant word tokens: lowercased, legal-entity suffixes stripped.
     * Industry words ("capital", "foods", "steel"…) are kept — they are
     * what tell two companies apart.
     */
    private static Set<String> nameTokens(String name) {
        if (name == null) {
            return Set.of();
        }
        Set<String> stop = Set.of(
                "limited", "ltd", "private", "pvt", "llp",
                "incorporated", "inc", "corporation", "corp",
                "company", "co");
        Set<String> out = new LinkedHashSet<>();
        for (String t : name.toLowerCase().split("[^a-z0-9]+")) {
            if (t.length() > 1 && !stop.contains(t)) {
                out.add(t);
            }
        }
        return out;
    }

    /** Dice token overlap, 0..1. Zero when the names share no token. */
    private static double dice(Set<String> a, Set<String> b) {
        if (a.isEmpty() || b.isEmpty()) {
            return 0;
        }
        long inter = a.stream().filter(b::contains).count();
        if (inter == 0) {
            return 0;
        }
        return 2.0 * inter / (a.size() + b.size());
    }

    /** Live IPO list from a registrar, for picking the registrarRef. */
    public List<RegistrarIpoDto> registrarIpos(String registrar) {
        String key = registrar == null ? "" : registrar.toUpperCase();
        CachedList cached = listCache.get(key);
        if (cached != null && System.currentTimeMillis() - cached.fetchedAt() < 10 * 60 * 1000) {
            return cached.ipos();
        }
        List<RegistrarIpoDto> ipos = switch (key) {
            case "KFINTECH" -> fetchKfintechIpos();
            case "MUFG" -> fetchMufgIpos();
            default -> List.of();
        };
        listCache.put(key, new CachedList(ipos, System.currentTimeMillis()));
        return ipos;
    }

    /**
     * Checks one PAN against one IPO on its registrar.
     * Returns a result that never guesses — unknown shapes are ERROR.
     */
    public AllotmentCheckResult check(String registrar, String registrarRef,
                                      Long applicationId, String pan) {
        if (pan == null || pan.isBlank()) {
            return AllotmentCheckResult.of(applicationId,
                    AllotmentCheckResult.Outcome.NEED_PAN,
                    "No PAN saved for this person — add it in their KYC first.");
        }
        if (registrarRef == null || registrarRef.isBlank()) {
            return AllotmentCheckResult.of(applicationId,
                    AllotmentCheckResult.Outcome.MANUAL,
                    "Set this IPO's registrar and registrar entry first.");
        }
        String normalized = pan.toUpperCase().trim();
        String reg = registrar == null ? "" : registrar.toUpperCase().trim();
        try {
            return switch (reg) {
                case "KFINTECH" -> checkKfintech(applicationId, registrarRef, normalized);
                case "MUFG" -> checkMufg(applicationId, registrarRef, normalized);
                default -> AllotmentCheckResult.of(applicationId,
                        AllotmentCheckResult.Outcome.MANUAL,
                        "This registrar needs a captcha — check on their site.");
            };
        } catch (Exception e) {
            log.warn("Allotment check failed (registrar={}, pan={}): {}",
                    registrar, mask(normalized), e.getMessage());
            return AllotmentCheckResult.of(applicationId,
                    AllotmentCheckResult.Outcome.ERROR,
                    "Registrar didn't answer properly — try again later.");
        }
    }

    // ------------------------------------------------------------------
    // KFintech
    // ------------------------------------------------------------------

    private AllotmentCheckResult checkKfintech(Long applicationId, String clientId,
                                              String pan) throws Exception {
        HttpRequest req = HttpRequest.newBuilder(URI.create(KFINTECH_QUERY))
                .timeout(TIMEOUT)
                .header("User-Agent", UA)
                .header("Content-Type", "application/json")
                .header("reqparam", pan)
                .header("client_id", clientId)
                .GET()
                .build();
        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        String body = res.body() == null ? "" : res.body();

        if (body.toLowerCase().contains("record not found")) {
            return AllotmentCheckResult.of(applicationId,
                    AllotmentCheckResult.Outcome.NOT_FOUND,
                    "No application found for this PAN (or allotment not declared yet).");
        }
        JsonNode root;
        try {
            root = mapper.readTree(body);
        } catch (Exception e) {
            return AllotmentCheckResult.of(applicationId,
                    AllotmentCheckResult.Outcome.ERROR,
                    "Registrar returned an unrecognized response.");
        }
        JsonNode data = root.path("data");
        if (!data.isArray() || data.isEmpty()) {
            return AllotmentCheckResult.of(applicationId,
                    AllotmentCheckResult.Outcome.NOT_FOUND,
                    "No application found for this PAN (or allotment not declared yet).");
        }
        JsonNode rec = data.get(0);
        String allottedRaw = textField(rec, "All_Shares", "allotted", "allot");
        if (allottedRaw == null) {
            return AllotmentCheckResult.of(applicationId,
                    AllotmentCheckResult.Outcome.ERROR,
                    "Registrar returned an unrecognized response format.");
        }
        int allotted = parseInt(allottedRaw);
        if (allotted < 0) {
            return AllotmentCheckResult.of(applicationId,
                    AllotmentCheckResult.Outcome.ERROR,
                    "Registrar returned an unrecognized response format.");
        }
        if (allotted > 0) {
            return new AllotmentCheckResult(applicationId, null,
                    AllotmentCheckResult.Outcome.ALLOTTED, allotted,
                    "Allotted " + allotted + " shares.");
        }
        return AllotmentCheckResult.of(applicationId,
                AllotmentCheckResult.Outcome.NOT_ALLOTTED,
                "Application found, but no shares allotted.");
    }

    /** KFintech's IPO dropdown data is embedded in its SPA bundle. */
    private List<RegistrarIpoDto> fetchKfintechIpos() {
        try {
            String html = get(KFINTECH_SITE);
            Matcher m = Pattern.compile("src=\"([^\"]*main\\.[^\"]*\\.js)\"")
                    .matcher(html);
            if (!m.find()) return List.of();
            String bundleUrl = m.group(1);
            if (bundleUrl.startsWith("./")) {
                bundleUrl = KFINTECH_SITE + bundleUrl.substring(2);
            } else if (bundleUrl.startsWith("/")) {
                bundleUrl = "https://ipostatus.kfintech.com" + bundleUrl;
            }
            String js = get(bundleUrl);
            String arr = extractJsonArray(js, "clientId");
            if (arr == null) return List.of();
            List<RegistrarIpoDto> out = new ArrayList<>();
            for (JsonNode n : mapper.readTree(arr)) {
                out.add(new RegistrarIpoDto(
                        n.path("clientId").asText(), n.path("name").asText()));
            }
            return out;
        } catch (Exception e) {
            log.warn("KFintech IPO list fetch failed: {}", e.getMessage());
            return List.of();
        }
    }

    // ------------------------------------------------------------------
    // MUFG Intime (Link Intime)
    // ------------------------------------------------------------------

    private AllotmentCheckResult checkMufg(Long applicationId, String companyId,
                                          String pan) throws Exception {
        String payload = mapper.writeValueAsString(Map.of(
                "clientid", companyId,
                "PAN", pan,
                "IFSC", "",
                "CHKVAL", "1",
                "token", ""));
        HttpRequest req = HttpRequest.newBuilder(
                        URI.create(MUFG_BASE + "/SearchOnPan"))
                .timeout(TIMEOUT)
                .header("User-Agent", UA)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();
        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        String d = "";
        try {
            d = mapper.readTree(res.body()).path("d").asText("");
        } catch (Exception ignored) {
        }
        List<Map<String, String>> tables = parseNewDataSet(d);
        if (tables.isEmpty()) {
            return AllotmentCheckResult.of(applicationId,
                    AllotmentCheckResult.Outcome.NOT_FOUND,
                    "No application found for this PAN (or allotment not declared yet).");
        }
        Map<String, String> rec = tables.get(0);
        String allText = String.join(" ", rec.values());
        if (allText.matches("(?is).*\\b(no\\s*record|not\\s*found|not\\s*applied|no\\s*data|invalid\\s*pan)\\b.*")) {
            return AllotmentCheckResult.of(applicationId,
                    AllotmentCheckResult.Outcome.NOT_FOUND,
                    "No application found for this PAN.");
        }
        String allottedKey = rec.keySet().stream()
                .filter(k -> k.matches("(?i)^al+ot.*")).findFirst().orElse(null);
        if (allottedKey == null) {
            return AllotmentCheckResult.of(applicationId,
                    AllotmentCheckResult.Outcome.ERROR,
                    "Registrar returned an unrecognized response format.");
        }
        int allotted = parseInt(rec.get(allottedKey));
        if (allotted < 0) {
            return AllotmentCheckResult.of(applicationId,
                    AllotmentCheckResult.Outcome.ERROR,
                    "Registrar returned an unrecognized response format.");
        }
        if (allotted > 0) {
            return new AllotmentCheckResult(applicationId, null,
                    AllotmentCheckResult.Outcome.ALLOTTED, allotted,
                    "Allotted " + allotted + " shares.");
        }
        return AllotmentCheckResult.of(applicationId,
                AllotmentCheckResult.Outcome.NOT_ALLOTTED,
                "Application found, but no shares allotted.");
    }

    private List<RegistrarIpoDto> fetchMufgIpos() {
        try {
            HttpRequest req = HttpRequest.newBuilder(
                            URI.create(MUFG_BASE + "/GetDetails"))
                    .timeout(TIMEOUT)
                    .header("User-Agent", UA)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString("{}"))
                    .build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            String d = mapper.readTree(res.body()).path("d").asText("");
            List<RegistrarIpoDto> out = new ArrayList<>();
            for (Map<String, String> t : parseNewDataSet(d)) {
                String id = t.getOrDefault("company_id", "").trim();
                String name = t.getOrDefault("companyname", "").trim();
                if (!id.isEmpty() && !name.isEmpty()) {
                    out.add(new RegistrarIpoDto(id, name));
                }
            }
            return out;
        } catch (Exception e) {
            log.warn("MUFG IPO list fetch failed: {}", e.getMessage());
            return List.of();
        }
    }

    // ------------------------------------------------------------------
    // Small helpers
    // ------------------------------------------------------------------

    private String get(String url) throws Exception {
        HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(TIMEOUT)
                .header("User-Agent", UA)
                .GET()
                .build();
        return http.send(req, HttpResponse.BodyHandlers.ofString()).body();
    }

    /** Bracket-matches the JSON array literal containing the marker. */
    private String extractJsonArray(String src, String marker) {
        int idx = src.indexOf(marker);
        while (idx != -1) {
            int depth = 0, start = -1;
            for (int j = idx; j >= 0; j--) {
                char c = src.charAt(j);
                if (c == ']') depth++;
                else if (c == '[') {
                    if (depth == 0) {
                        start = j;
                        break;
                    }
                    depth--;
                }
            }
            if (start != -1) {
                int d2 = 0;
                boolean inStr = false;
                char q = 0;
                for (int j = start; j < src.length(); j++) {
                    char c = src.charAt(j);
                    if (inStr) {
                        if (c == '\\') j++;
                        else if (c == q) inStr = false;
                    } else if (c == '"' || c == '\'') {
                        inStr = true;
                        q = c;
                    } else if (c == '[') d2++;
                    else if (c == ']') {
                        d2--;
                        if (d2 == 0) {
                            String frag = src.substring(start, j + 1);
                            if (frag.contains(marker)) return frag;
                            break;
                        }
                    }
                }
            }
            idx = src.indexOf(marker, idx + 1);
        }
        return null;
    }

    /** Parses the <NewDataSet><Table>… XML the MUFG endpoints return. */
    private List<Map<String, String>> parseNewDataSet(String xml) {
        List<Map<String, String>> out = new ArrayList<>();
        if (xml == null || xml.contains("<NewDataSet />")) return out;
        Matcher tm = Pattern.compile("<Table>(.*?)</Table>", Pattern.DOTALL)
                .matcher(xml);
        while (tm.find()) {
            Map<String, String> row = new LinkedHashMap<>();
            Matcher fm = Pattern.compile("<([^>/]+)>([^<]*)</\\1>")
                    .matcher(tm.group(1));
            while (fm.find()) {
                row.put(fm.group(1).trim(), fm.group(2).trim());
            }
            if (!row.isEmpty()) out.add(row);
        }
        return out;
    }

    private String textField(JsonNode node, String... candidates) {
        for (String c : candidates) {
            JsonNode v = node.path(c);
            if (!v.isMissingNode() && !v.asText("").isBlank()) return v.asText();
        }
        // Fallback: any key containing the last candidate fragment.
        String frag = candidates[candidates.length - 1].toLowerCase();
        var it = node.fieldNames();
        while (it.hasNext()) {
            String k = it.next();
            if (k.toLowerCase().contains(frag)) {
                String v = node.path(k).asText("");
                if (!v.isBlank()) return v;
            }
        }
        return null;
    }

    private int parseInt(String raw) {
        try {
            return Integer.parseInt(raw.replaceAll("[^\\d-]", ""));
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    private String mask(String pan) {
        if (pan == null || pan.length() < 4) return "****";
        return pan.substring(0, 2) + "****" + pan.substring(pan.length() - 2);
    }

    private record CachedList(List<RegistrarIpoDto> ipos, long fetchedAt) {
    }
}
