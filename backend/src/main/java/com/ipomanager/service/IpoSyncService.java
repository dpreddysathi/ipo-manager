package com.ipomanager.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ipomanager.model.ApplicationStatus;
import com.ipomanager.model.AppUser;
import com.ipomanager.model.Ipo;
import com.ipomanager.model.IpoStatus;
import com.ipomanager.repository.ApplicationRepository;
import com.ipomanager.repository.AppUserRepository;
import com.ipomanager.repository.IpoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Keeps the board stocked with every mainboard IPO, automatically.
 *
 * <p>Source: Chittorgarh's IPO report JSON
 * ({@code webnodejs.chittorgarh.com/cloud/report/data-read/82/...}) — the same
 * feed their own list page renders. One row per IPO: dates, price band, issue
 * size, lead manager, listing exchange. Lot size and the basis-of-allotment
 * date come from each IPO's Chittorgarh detail page (best effort).
 *
 * <p>Rules, per the owner's spec:
 * <ul>
 *   <li>Runs daily at 06:30 IST, once at startup, and on demand via
 *       {@code POST /api/ipos/sync}.</li>
 *   <li>The feed pass (new rows, refreshes, auto-hide) is fast and
 *       synchronous; detail-page enrichment (lot size, allotment date) runs
 *       in a background thread so the board never waits for it.</li>
 *   <li>Only {@code Issue Category = Mainboard} rows are imported.</li>
 *   <li>One AUTO row per user (matched by normalized name) — hand-added
 *       MANUAL rows are never created over, and never modified.</li>
 *   <li>AUTO rows get their dates/status/price-band refreshed on every sync,
 *       but the sync never un-hides a row the user removed.</li>
 *   <li>Past the allotment date, a row auto-hides from the board — unless the
 *       user got an allotment in it (those stay until sold and noted).</li>
 * </ul>
 *
 * <p>Hidden rows stay in the DB and remain searchable; hiding is only about
 * what the board shows.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class IpoSyncService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final String FEED_URL =
            "https://webnodejs.chittorgarh.com/cloud/report/data-read/82/%d/7/%d/%s/0/all";
    private static final String UA =
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
    private static final Duration TIMEOUT = Duration.ofSeconds(25);
    /** Pause between detail-page fetches — stay polite to the source site. */
    private static final long DETAIL_PAUSE_MS = 500;

    private static final DateTimeFormatter FEED_DATE =
            DateTimeFormatter.ofPattern("d-MMM-yyyy", Locale.ENGLISH);
    private static final DateTimeFormatter ALLOTMENT_FMT =
            DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.ENGLISH);
    private static final Pattern BAND =
            Pattern.compile("([\\d,]+(?:\\.\\d+)?)\\s*to\\s*([\\d,]+(?:\\.\\d+)?)");
    private static final Pattern HREF = Pattern.compile("href=\"([^\"]+)\"");
    private static final Pattern LOT_SIZE =
            Pattern.compile("(?i)lot size[^0-9]{0,150}?([\\d,]+)\\s*shares");
    private static final Pattern ALLOTMENT_DATE =
            Pattern.compile("(?i)allotment[^.]{0,80}?will be done on\\s+\\w+,\\s+([A-Za-z]+ \\d{1,2}, \\d{4})");

    private final IpoRepository ipoRepository;
    private final ApplicationRepository applicationRepository;
    private final AppUserRepository appUserRepository;

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(TIMEOUT)
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();
    private final ObjectMapper mapper = new ObjectMapper();

    /**
     * Background worker for the slow part (detail-page enrichment). Daemon
     * thread: never blocks startup or shutdown.
     */
    private final ExecutorService bg = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "ipo-sync-bg");
        t.setDaemon(true);
        return t;
    });

    public record SyncSummary(int added, int updated, int hidden) {
    }

    private record FeedIpo(String name, String detailUrl, LocalDate open, LocalDate close,
                           LocalDate listing, BigDecimal priceLow, BigDecimal priceHigh,
                           String issueSize, String leadManager, String exchange) {
    }

    /** Daily run: 06:30 IST, quiet on failure — the board keeps working regardless. */
    @Scheduled(cron = "0 30 6 * * *", zone = "Asia/Kolkata")
    public void scheduledSync() {
        try {
            SyncSummary s = syncFeed();
            log.info("IPO sync done: added={} updated={} hidden={}",
                    s.added(), s.updated(), s.hidden());
            submitEnrichment();
        } catch (Exception e) {
            log.warn("IPO sync failed: {}", e.toString());
        }
    }

    /**
     * First boot after a deploy/restart: fill the board in the background so
     * it's already there when the user opens the page — no button needed.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        bg.submit(() -> {
            try {
                SyncSummary s = syncFeed();
                log.info("IPO sync (startup) done: added={} updated={} hidden={}",
                        s.added(), s.updated(), s.hidden());
                enrichMissingDetails();
            } catch (Exception e) {
                log.warn("IPO sync (startup) failed: {}", e.toString());
            }
        });
    }

    /**
     * The fast pass: feed fetch + upsert + auto-hide. Seconds, safe to call
     * synchronously from the manual "Sync now" button.
     */
    public SyncSummary syncFeed() {
        List<FeedIpo> feed = fetchFeed();
        if (feed.isEmpty()) {
            log.warn("IPO sync: feed returned nothing, skipping");
            return new SyncSummary(0, 0, 0);
        }
        int added = 0, updated = 0, hidden = 0;
        for (AppUser user : appUserRepository.findAll()) {
            SyncSummary s = syncUser(user.getId(), feed);
            added += s.added();
            updated += s.updated();
            hidden += s.hidden();
        }
        return new SyncSummary(added, updated, hidden);
    }

    /** Queue the slow detail-page enrichment; returns immediately. */
    public void submitEnrichment() {
        bg.submit(() -> {
            try {
                enrichMissingDetails();
            } catch (Exception e) {
                log.warn("IPO sync (enrichment) failed: {}", e.toString());
            }
        });
    }

    /**
     * The slow pass: lot size + allotment date from each IPO's detail page.
     * Always runs in the background — the board never waits for it.
     */
    private void enrichMissingDetails() {
        Map<String, String> detailUrls = new HashMap<>();
        for (FeedIpo f : fetchFeed()) {
            detailUrls.putIfAbsent(normalize(f.name()), f.detailUrl());
        }
        for (AppUser user : appUserRepository.findAll()) {
            for (Ipo ipo : ipoRepository.findByOwnerId(user.getId())) {
                if (isManual(ipo)
                        || (ipo.getLotSize() != null && ipo.getAllotmentDate() != null)) {
                    continue;
                }
                enrichFromDetailPage(ipo, detailUrls.get(normalize(ipo.getName())));
            }
        }
        log.info("IPO sync: detail enrichment pass done");
    }

    private SyncSummary syncUser(Long ownerId, List<FeedIpo> feed) {
        Map<String, Ipo> byName = new HashMap<>();
        for (Ipo ipo : ipoRepository.findByOwnerId(ownerId)) {
            byName.putIfAbsent(normalize(ipo.getName()), ipo);
        }
        int added = 0, updated = 0;
        for (FeedIpo f : feed) {
            String key = normalize(f.name());
            Ipo existing = byName.get(key);
            if (existing != null) {
                if (isManual(existing)) {
                    continue; // hand-added rows are never touched
                }
                if (refresh(existing, f)) {
                    ipoRepository.save(existing);
                    updated++;
                }
            } else {
                Ipo ipo = new Ipo();
                ipo.setOwnerId(ownerId);
                ipo.setName(f.name());
                ipo.setSource("AUTO");
                ipo.setBoardHidden(false);
                fill(ipo, f);
                ipoRepository.save(ipo);
                byName.put(key, ipo);
                added++;
            }
        }
        return new SyncSummary(added, updated, autoHide(ownerId));
    }

    /**
     * Past the allotment date, rows leave the board on their own — except ones
     * where the user actually got an allotment, which stay until sold + noted.
     */
    private int autoHide(Long ownerId) {
        LocalDate today = LocalDate.now(IST);
        int hidden = 0;
        for (Ipo ipo : ipoRepository.findByOwnerId(ownerId)) {
            if (Boolean.TRUE.equals(ipo.getBoardHidden())) {
                continue;
            }
            LocalDate allotment = ipo.getAllotmentDate() != null
                    ? ipo.getAllotmentDate()
                    : ipo.getCloseDate() != null ? ipo.getCloseDate().plusDays(1) : null;
            if (allotment == null || allotment.isAfter(today)) {
                continue;
            }
            boolean gotAllotment = applicationRepository
                    .existsByIpoIdAndStatus(ipo.getId(), ApplicationStatus.ALLOTTED);
            if (gotAllotment) {
                continue;
            }
            ipo.setBoardHidden(true);
            ipoRepository.save(ipo);
            hidden++;
        }
        return hidden;
    }

    /** Best-effort: lot size + basis-of-allotment date from the detail page. */
    private void enrichFromDetailPage(Ipo ipo, String detailUrl) {
        if (detailUrl == null || detailUrl.isBlank()) {
            return;
        }
        try {
            String html = get(detailUrl);
            boolean changed = false;
            if (ipo.getLotSize() == null) {
                Matcher m = LOT_SIZE.matcher(html);
                if (m.find()) {
                    ipo.setLotSize(Integer.parseInt(m.group(1).replace(",", "")));
                    changed = true;
                }
            }
            if (ipo.getAllotmentDate() == null) {
                Matcher m = ALLOTMENT_DATE.matcher(html);
                if (m.find()) {
                    try {
                        ipo.setAllotmentDate(LocalDate.parse(m.group(1), ALLOTMENT_FMT));
                        changed = true;
                    } catch (Exception ignored) {
                        // unexpected date wording — fall back to close+1
                    }
                }
            }
            if (changed) {
                ipoRepository.save(ipo);
            }
            Thread.sleep(DETAIL_PAUSE_MS);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            log.warn("IPO sync: detail fetch failed for {}: {}", ipo.getName(), e.getMessage());
        }
    }

    /** Current + previous financial year, so recently-listed IPOs stay searchable. */
    private List<FeedIpo> fetchFeed() {
        LocalDate today = LocalDate.now(IST);
        int fyStart = today.getMonthValue() >= 4 ? today.getYear() : today.getYear() - 1;
        List<FeedIpo> out = new ArrayList<>();
        out.addAll(fetchFy(fyStart));
        out.addAll(fetchFy(fyStart - 1));
        return out;
    }

    private List<FeedIpo> fetchFy(int fyStart) {
        String url = FEED_URL.formatted(1, fyStart, String.valueOf(fyStart + 1));
        try {
            JsonNode rows = mapper.readTree(get(url)).path("reportTableData");
            List<FeedIpo> out = new ArrayList<>();
            if (rows.isArray()) {
                for (JsonNode r : rows) {
                    if (!"Mainboard".equalsIgnoreCase(text(r, "Issue Category"))) {
                        continue;
                    }
                    FeedIpo f = parseRow(r);
                    if (f != null) {
                        out.add(f);
                    }
                }
            }
            log.info("IPO sync: {} mainboard rows for FY {}-{}", out.size(), fyStart, fyStart + 1);
            return out;
        } catch (Exception e) {
            log.warn("IPO sync: feed fetch failed for FY {}-{}: {}",
                    fyStart, fyStart + 1, e.getMessage());
            return List.of();
        }
    }

    private FeedIpo parseRow(JsonNode r) {
        String companyHtml = text(r, "Company");
        if (companyHtml.isBlank()) {
            return null;
        }
        String name = companyHtml.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
        if (name.isBlank()) {
            return null;
        }
        Matcher href = HREF.matcher(companyHtml);
        String detailUrl = href.find() ? href.group(1) : null;

        BigDecimal low = null, high = null;
        Matcher band = BAND.matcher(text(r, "Issue Price (Rs)"));
        if (band.find()) {
            low = number(band.group(1));
            high = number(band.group(2));
        }
        String amt = text(r, "Issue Amount (Rs Cr.)").replace(",", "").trim();
        String issueSize = amt.isBlank() ? null : "₹" + amt.replaceAll("\\.0+$", "") + " cr";
        String exchange = text(r, "Listing At").replace(",", ", ").trim();

        return new FeedIpo(
                name,
                detailUrl,
                parseDate(r, "Opening Date"),
                parseDate(r, "Closing Date"),
                parseDate(r, "Listing Date"),
                low, high,
                issueSize,
                emptyToNull(text(r, "Lead Manager")),
                exchange.isBlank() ? null : exchange);
    }

    private void fill(Ipo ipo, FeedIpo f) {
        ipo.setOpenDate(f.open());
        ipo.setCloseDate(f.close());
        ipo.setListingDate(f.listing());
        ipo.setStatus(deriveStatus(f));
        ipo.setPriceHigh(f.priceHigh());
        ipo.setPriceLow(f.priceLow());
        ipo.setIssueSize(f.issueSize());
        ipo.setLeadManager(f.leadManager());
        ipo.setListingExchange(f.exchange());
    }

    /** Refresh a sync-owned row; true when something actually changed. */
    private boolean refresh(Ipo ipo, FeedIpo f) {
        boolean changed = false;
        changed |= setIfChanged(ipo::getOpenDate, ipo::setOpenDate, f.open());
        changed |= setIfChanged(ipo::getCloseDate, ipo::setCloseDate, f.close());
        changed |= setIfChanged(ipo::getListingDate, ipo::setListingDate, f.listing());
        changed |= setIfChanged(ipo::getStatus, ipo::setStatus, deriveStatus(f));
        changed |= setIfChanged(ipo::getPriceLow, ipo::setPriceLow, f.priceLow());
        changed |= setIfChanged(ipo::getPriceHigh, ipo::setPriceHigh, f.priceHigh());
        changed |= setIfChanged(ipo::getIssueSize, ipo::setIssueSize, f.issueSize());
        changed |= setIfChanged(ipo::getLeadManager, ipo::setLeadManager, f.leadManager());
        changed |= setIfChanged(ipo::getListingExchange, ipo::setListingExchange, f.exchange());
        return changed;
    }

    private IpoStatus deriveStatus(FeedIpo f) {
        LocalDate today = LocalDate.now(IST);
        if (f.listing() != null && !f.listing().isAfter(today)) {
            return IpoStatus.LISTED;
        }
        if (f.close() != null && f.close().isBefore(today)) {
            return IpoStatus.CLOSED;
        }
        if (f.open() != null && !f.open().isAfter(today)) {
            return IpoStatus.OPEN;
        }
        return IpoStatus.UPCOMING;
    }

    private static boolean isManual(Ipo ipo) {
        return !"AUTO".equals(ipo.getSource());
    }

    /** Lowercase, punctuation and legal-entity suffixes stripped — for dedup. */
    static String normalize(String name) {
        if (name == null) {
            return "";
        }
        String s = name.toLowerCase(Locale.ENGLISH).replaceAll("[^a-z0-9 ]", " ");
        s = s.replaceAll(
                "\\b(limited|ltd|private|pvt|llp|incorporated|inc|corporation|corp)\\b", " ");
        return s.replaceAll("\\s+", " ").trim();
    }

    private LocalDate parseDate(JsonNode r, String field) {
        String iso = r.path(field + "_1").asText("");
        if (!iso.isBlank()) {
            try {
                return LocalDate.parse(iso);
            } catch (Exception ignored) {
            }
        }
        String display = text(r, field);
        if (!display.isBlank()) {
            try {
                return LocalDate.parse(display, FEED_DATE);
            } catch (Exception ignored) {
            }
        }
        return null;
    }

    private static BigDecimal number(String raw) {
        try {
            return new BigDecimal(raw.replace(",", ""));
        } catch (Exception e) {
            return null;
        }
    }

    private static String text(JsonNode node, String field) {
        return node.path(field).asText("").trim();
    }

    private static String emptyToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }

    private static <T> boolean setIfChanged(
            java.util.function.Supplier<T> getter,
            java.util.function.Consumer<T> setter,
            T value) {
        if (java.util.Objects.equals(getter.get(), value)) {
            return false;
        }
        setter.accept(value);
        return true;
    }

    private String get(String url) throws Exception {
        HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(TIMEOUT)
                .header("User-Agent", UA)
                .header("Referer", "https://www.chittorgarh.com/")
                .header("Accept", "application/json, text/html")
                .GET()
                .build();
        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200) {
            throw new IllegalStateException("HTTP " + res.statusCode());
        }
        return res.body();
    }
}
