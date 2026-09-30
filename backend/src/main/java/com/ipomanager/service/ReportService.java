package com.ipomanager.service;

import com.ipomanager.dto.ApplicationDto;
import com.ipomanager.dto.IpoSummaryDto;
import com.ipomanager.dto.PartyOwed;
import com.ipomanager.dto.PersonReportDto;
import com.ipomanager.dto.PersonReportRow;
import com.ipomanager.dto.ReportFilter;
import com.ipomanager.dto.SendReportRequest;
import com.ipomanager.dto.SendReportResponse;
import com.ipomanager.dto.TransactionDto;
import com.ipomanager.exception.ResourceNotFoundException;
import com.ipomanager.model.Application;
import com.ipomanager.model.ApplicationStatus;
import com.ipomanager.model.Ipo;
import com.ipomanager.model.Person;
import com.ipomanager.model.ReportLog;
import com.ipomanager.model.Transaction;
import com.ipomanager.model.TxnStatus;
import com.ipomanager.repository.ApplicationRepository;
import com.ipomanager.repository.IpoRepository;
import com.ipomanager.repository.PersonRepository;
import com.ipomanager.repository.ReportLogRepository;
import com.ipomanager.repository.TransactionRepository;
import com.ipomanager.security.AuthContext;
import com.ipomanager.util.Inr;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * Builds person reports (the data behind the Person Report Drawer) and the
 * plain-text report messages sent via {@code POST /api/reports/send}.
 *
 * <p>Money is person-to-person: every transaction has a sender and a
 * receiver (either side may be you, "Me"), and the receiver owes the
 * sender until a return leg moves the money back. The message is always
 * built server-side from the report data — the client never supplies
 * message text. No SMS gateway is configured, so sending returns a
 * pre-filled {@code wa.me} link (status "manual") and a {@link ReportLog}
 * row is persisted for the audit trail.
 *
 * <p>Both the drawer preview and the sent message accept the same
 * {@link ReportFilter} (settled/unsettled, unallotted-only, IPO, date
 * window) so the message always matches what the drawer showed.
 */
@Service
@RequiredArgsConstructor
public class ReportService {

    private static final DateTimeFormatter DAY_MONTH_TIME =
            DateTimeFormatter.ofPattern("d MMM, h:mm a", Locale.ENGLISH);

    private final PersonRepository personRepository;
    private final IpoRepository ipoRepository;
    private final TransactionRepository transactionRepository;
    private final ApplicationRepository applicationRepository;
    private final ReportLogRepository reportLogRepository;

    @Transactional(readOnly = true)
    public PersonReportDto buildReport(Long personId, Long ipoId) {
        return buildReport(personId, ipoId, new ReportFilter());
    }

    @Transactional(readOnly = true)
    public PersonReportDto buildReport(Long personId, Long ipoId, ReportFilter filter) {
        Long userId = AuthContext.currentUserId();
        Person person = personRepository.findByIdAndOwnerId(personId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Person", personId));

        final List<Ipo> ipos;
        if (ipoId != null) {
            Ipo ipo = ipoRepository.findByIdAndOwnerId(ipoId, userId)
                    .orElseThrow(() -> new ResourceNotFoundException("Ipo", ipoId));
            ipos = List.of(ipo);
        } else {
            Set<Long> ids = new LinkedHashSet<>();
            transactionRepository.findInvolvingPerson(userId, personId)
                    .forEach(t -> ids.add(t.getIpo().getId()));
            applicationRepository.findByPersonId(personId)
                    .forEach(a -> ids.add(a.getIpo().getId()));
            ipos = ipoRepository.findAllById(ids).stream()
                    .sorted(Comparator.comparing(Ipo::getId))
                    .toList();
        }

        List<PersonReportRow> rows = ipos.stream()
                .map(ipo -> buildRow(personId, ipo, filter))
                .filter(Objects::nonNull)
                .toList();

        BigDecimal totalApplied = rows.stream()
                .map(PersonReportRow::getApplied).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalReceived = rows.stream()
                .map(PersonReportRow::getReceived).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalSent = rows.stream()
                .map(PersonReportRow::getSent).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalOutstanding = rows.stream()
                .map(PersonReportRow::getOutstanding).reduce(BigDecimal.ZERO, BigDecimal::add);

        return new PersonReportDto(
                person, rows,
                new PersonReportDto.ReportTotals(
                        totalApplied, totalReceived, totalSent, totalOutstanding));
    }

    /**
     * Builds one IPO row for a person, or {@code null} when the row is
     * excluded by the active filters.
     */
    private PersonReportRow buildRow(Long personId, Ipo ipo, ReportFilter filter) {
        Long userId = AuthContext.currentUserId();
        String personKey = "P:" + personId;
        List<Transaction> allTxns = transactionRepository
                .findInvolvingPerson(userId, personId).stream()
                .filter(t -> t.getIpo().getId().equals(ipo.getId()))
                .toList();

        // Ledger truth is computed over everything; filters only change
        // what is listed and summed.
        Map<Long, BigDecimal> outstanding = Ledger.outstandingByTxn(allTxns);
        Map<Long, Boolean> struck = Ledger.struckByTxn(allTxns);

        List<Transaction> txns = allTxns.stream()
                .filter(t -> filter.isIncludeSettled() || !t.isSettled())
                .filter(t -> inWindow(t.getTxnDate(), filter))
                .toList();

        BigDecimal received = txns.stream()
                .filter(t -> personKey.equals(Ledger.partyKey(t.getReceiverPerson())))
                .map(Transaction::getAmount).filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal sent = txns.stream()
                .filter(t -> personKey.equals(Ledger.partyKey(t.getSenderPerson())))
                .map(Transaction::getAmount).filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, String> names = partyNames(allTxns);
        List<PartyOwed> owes = new ArrayList<>();
        List<PartyOwed> owedBy = new ArrayList<>();
        for (Map.Entry<Ledger.Triple, BigDecimal> e
                : Ledger.netByTriple(allTxns).entrySet()) {
            Ledger.Triple triple = e.getKey();
            if (triple.receiverKey().equals(personKey)) {
                owes.add(new PartyOwed(partyIdOf(triple.senderKey()),
                        names.getOrDefault(triple.senderKey(), "?"), e.getValue()));
            } else if (triple.senderKey().equals(personKey)) {
                owedBy.add(new PartyOwed(partyIdOf(triple.receiverKey()),
                        names.getOrDefault(triple.receiverKey(), "?"), e.getValue()));
            }
        }
        Comparator<PartyOwed> byAmount =
                Comparator.comparing(PartyOwed::getAmount).reversed();
        owes.sort(byAmount);
        owedBy.sort(byAmount);
        BigDecimal outstandingTotal = owes.stream().map(PartyOwed::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<Application> applications = filteredApps(personId, ipo.getId(), filter);
        BigDecimal applied = applications.stream()
                .map(Application::getAppliedAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (!filter.isIncludeSettled() && received.signum() == 0
                && sent.signum() == 0 && applied.signum() == 0) {
            return null;
        }
        if (filter.isOnlyUnallotted()
                && applications.stream().anyMatch(a -> a.getStatus() == ApplicationStatus.ALLOTTED)) {
            return null;
        }
        if (filter.hasDateWindow()
                && received.signum() == 0 && sent.signum() == 0 && applied.signum() == 0) {
            return null;
        }

        List<ApplicationDto> applicationDtos = applications.stream()
                .map(ApplicationDto::from)
                .toList();
        List<TransactionDto> txnDtos = txns.stream()
                .sorted(Comparator.comparing(Transaction::getTxnDate,
                        Comparator.nullsLast(Comparator.naturalOrder())).reversed())
                .map(t -> {
                    TransactionDto dto = TransactionDto.from(t);
                    dto.setOutstanding(outstanding.getOrDefault(t.getId(),
                            BigDecimal.ZERO));
                    dto.setStruck(struck.getOrDefault(t.getId(), false));
                    return dto;
                })
                .toList();
        return new PersonReportRow(
                ipo.getId(), ipo.getName(), applied, deriveStatus(applications),
                applicationDtos, txnDtos, owes, owedBy,
                received, sent, outstandingTotal);
    }

    /**
     * The complete picture of one IPO: applications with their funders,
     * allotment counts, every money movement, and who still owes whom.
     */
    @Transactional(readOnly = true)
    public IpoSummaryDto summary(Long ipoId) {
        Long userId = AuthContext.currentUserId();
        Ipo ipo = ipoRepository.findByIdAndOwnerId(ipoId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Ipo", ipoId));

        List<Transaction> txns = transactionRepository.findByIpo(userId, ipoId);
        Map<Long, BigDecimal> outstanding = Ledger.outstandingByTxn(txns);
        Map<Long, Boolean> struck = Ledger.struckByTxn(txns);
        Map<String, String> names = partyNames(txns);

        List<TransactionDto> txnDtos = txns.stream()
                .sorted(Comparator.comparing(Transaction::getTxnDate,
                        Comparator.nullsLast(Comparator.naturalOrder())).reversed())
                .map(t -> {
                    TransactionDto dto = TransactionDto.from(t);
                    dto.setOutstanding(outstanding.getOrDefault(t.getId(),
                            BigDecimal.ZERO));
                    dto.setStruck(struck.getOrDefault(t.getId(), false));
                    return dto;
                })
                .toList();

        List<IpoSummaryDto.DebtDto> debts = Ledger.netByTriple(txns).entrySet().stream()
                .map(e -> new IpoSummaryDto.DebtDto(
                        partyIdOf(e.getKey().senderKey()),
                        names.getOrDefault(e.getKey().senderKey(), "?"),
                        partyIdOf(e.getKey().receiverKey()),
                        names.getOrDefault(e.getKey().receiverKey(), "?"),
                        e.getValue()))
                .sorted(Comparator.comparing(IpoSummaryDto.DebtDto::getAmount)
                        .reversed())
                .toList();

        List<Application> applications =
                applicationRepository.findByIpo(userId, ipoId);
        List<IpoSummaryDto.ApplicationFundingDto> funding =
                applications.stream().map(app -> {
                    String applicantKey =
                            Ledger.partyKey(app.getPerson());
                    Map<String, List<Transaction>> byFunder = new LinkedHashMap<>();
                    for (Transaction t : txns) {
                        if (t.getReturnOf() != null) {
                            continue;
                        }
                        if (!applicantKey.equals(
                                Ledger.partyKey(t.getReceiverPerson()))) {
                            continue;
                        }
                        byFunder.computeIfAbsent(
                                        Ledger.partyKey(t.getSenderPerson()),
                                        k -> new ArrayList<>())
                                .add(t);
                    }
                    List<IpoSummaryDto.FunderDto> funders = byFunder.entrySet().stream()
                            .map(e -> new IpoSummaryDto.FunderDto(
                                    partyIdOf(e.getKey()),
                                    names.getOrDefault(e.getKey(), "?"),
                                    e.getValue().stream().map(Transaction::getAmount)
                                            .filter(Objects::nonNull)
                                            .reduce(BigDecimal.ZERO, BigDecimal::add),
                                    e.getValue().stream()
                                            .map(t -> outstanding.getOrDefault(t.getId(),
                                                    BigDecimal.ZERO))
                                            .reduce(BigDecimal.ZERO, BigDecimal::add)))
                            .sorted(Comparator.comparing(
                                    IpoSummaryDto.FunderDto::getAmount).reversed())
                            .toList();
                    BigDecimal fundedTotal = funders.stream()
                            .map(IpoSummaryDto.FunderDto::getAmount)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                    BigDecimal outstandingTotal = funders.stream()
                            .map(IpoSummaryDto.FunderDto::getOutstanding)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                    return new IpoSummaryDto.ApplicationFundingDto(
                            ApplicationDto.from(app), funders,
                            fundedTotal, outstandingTotal);
                }).toList();

        int allotted = (int) applications.stream()
                .filter(a -> a.getStatus() == ApplicationStatus.ALLOTTED).count();
        int notAllotted = (int) applications.stream()
                .filter(a -> a.getStatus() == ApplicationStatus.NOT_ALLOTTED).count();
        BigDecimal appliedTotal = applications.stream()
                .map(Application::getAppliedAmount).filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal receivedTotal = txns.stream()
                .filter(t -> t.getReturnOf() == null)
                .map(Transaction::getAmount).filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal outstandingTotal = debts.stream()
                .map(IpoSummaryDto.DebtDto::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new IpoSummaryDto(ipo.getId(), ipo.getName(),
                ipo.getStatus() == null ? null : ipo.getStatus().name(),
                applications.size(), allotted, notAllotted, appliedTotal,
                txnDtos, debts, funding, receivedTotal, outstandingTotal);
    }

    /** Resolves party keys ("ME" / "P:&lt;id&gt;") to display names. */
    private static Map<String, String> partyNames(List<Transaction> txns) {
        Map<String, String> names = new LinkedHashMap<>();
        for (Transaction t : txns) {
            names.putIfAbsent(Ledger.partyKey(t.getSenderPerson()),
                    t.getSenderName());
            names.putIfAbsent(Ledger.partyKey(t.getReceiverPerson()),
                    t.getReceiverName());
        }
        return names;
    }

    private static Long partyIdOf(String key) {
        return key.startsWith("P:") ? Long.parseLong(key.substring(2)) : null;
    }

    private List<Application> filteredApps(Long personId, Long ipoId, ReportFilter filter) {
        return applicationRepository.findByPersonIdAndIpoId(personId, ipoId).stream()
                .filter(a -> a.getCreatedAt() == null
                        || inWindow(a.getCreatedAt(), filter))
                .toList();
    }

    private boolean inWindow(LocalDateTime dateTime, ReportFilter filter) {
        if (dateTime == null) {
            return true;
        }
        LocalDate date = dateTime.toLocalDate();
        if (filter.getFromDate() != null && date.isBefore(filter.getFromDate())) {
            return false;
        }
        return filter.getToDate() == null || !date.isAfter(filter.getToDate());
    }

    private String deriveStatus(List<Application> apps) {
        if (apps.stream().anyMatch(a -> a.getStatus() == ApplicationStatus.ALLOTTED)) {
            return "ALLOTTED";
        }
        if (apps.stream().anyMatch(a -> a.getStatus() == ApplicationStatus.NOT_ALLOTTED)) {
            return "NOT_ALLOTTED";
        }
        if (apps.stream().anyMatch(a -> a.getStatus() == ApplicationStatus.REFUNDED)) {
            return "REFUNDED";
        }
        if (apps.stream().anyMatch(a -> a.getStatus() == ApplicationStatus.APPLIED)) {
            return "APPLIED";
        }
        return "NO_APPLICATION";
    }

    @Transactional
    public SendReportResponse sendReport(SendReportRequest request) {
        Long userId = AuthContext.currentUserId();
        Long personId = request.getPersonId();
        Long ipoId = request.getIpoId();
        Person person = personRepository.findByIdAndOwnerId(personId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Person", personId));
        ReportFilter filter = request.toFilter();
        PersonReportDto report = buildReport(personId, ipoId, filter);
        String filterNote = filter.describe();

        final String message;
        if (ipoId != null) {
            Optional<PersonReportRow> row = report.getIpos().stream().findFirst();
            if (row.isEmpty()) {
                message = "Hi " + person.getName()
                        + ", no IPO activity matches the selected filters."
                        + "\n— via IPO Manager";
            } else {
                message = singleIpoMessage(person, row.get(), filterNote);
            }
        } else {
            message = allIposMessage(person, report, filterNote);
        }

        String digits = normalizePhone(person.getPhone());
        String waLink = "https://wa.me/" + digits
                + "?text=" + URLEncoder.encode(message, StandardCharsets.UTF_8);

        ReportLog entry = new ReportLog();
        entry.setPerson(person);
        entry.setIpo(ipoId != null
                ? ipoRepository.findByIdAndOwnerId(ipoId, userId).orElse(null)
                : null);
        entry.setChannel("whatsapp");
        entry.setSentTo(digits);
        entry.setSentAt(LocalDateTime.now());
        entry.setStatus("manual");
        reportLogRepository.save(entry);

        return new SendReportResponse("manual", waLink, message);
    }

    private String singleIpoMessage(Person person, PersonReportRow row,
                                    String filterNote) {
        StringBuilder sb = new StringBuilder();
        sb.append("Hi ").append(person.getName())
                .append(", your ").append(row.getIpoName()).append(" IPO summary:\n");

        sb.append("Applied: ").append(Inr.format(row.getApplied())).append("\n");
        sb.append("Status: ").append(statusLabel(row.getStatus())).append("\n");

        if (!row.getOwes().isEmpty()) {
            sb.append("You owe:\n");
            for (PartyOwed o : row.getOwes()) {
                sb.append("  ").append(Inr.format(o.getAmount()))
                        .append(" to ").append(o.getPartyName()).append("\n");
            }
        }
        if (!row.getOwedBy().isEmpty()) {
            sb.append("Owed to you:\n");
            for (PartyOwed o : row.getOwedBy()) {
                sb.append("  ").append(Inr.format(o.getAmount()))
                        .append(" from ").append(o.getPartyName()).append("\n");
            }
        }

        if (row.getTransactions() != null && !row.getTransactions().isEmpty()) {
            sb.append("Movements:\n");
            for (TransactionDto t : row.getTransactions()) {
                sb.append("  ").append(t.getSenderName()).append(" → ")
                        .append(t.getReceiverName()).append(" ")
                        .append(Inr.format(t.getAmount()));
                if (t.getDate() != null) {
                    sb.append(" on ").append(t.getDate().format(DAY_MONTH_TIME));
                }
                sb.append(txnStatusNote(t));
                sb.append("\n");
            }
        }

        sb.append("Still owed by you: ").append(Inr.format(row.getOutstanding()));
        sb.append(row.getOutstanding().signum() == 0 ? " — settled.\n" : " — pending.\n");
        appendFilterNote(sb, filterNote);
        sb.append("— via IPO Manager");
        return sb.toString();
    }

    private String allIposMessage(Person person, PersonReportDto report, String filterNote) {
        StringBuilder sb = new StringBuilder();
        sb.append("Hi ").append(person.getName()).append(", your IPO summary:\n");
        for (PersonReportRow row : report.getIpos()) {
            sb.append("- ").append(row.getIpoName())
                    .append(": ").append(statusLabel(row.getStatus()));
            if (row.getOutstanding().signum() > 0) {
                sb.append(", you owe ").append(Inr.format(row.getOutstanding()));
                String to = row.getOwes().stream()
                        .map(PartyOwed::getPartyName)
                        .reduce((a, b) -> a + ", " + b).orElse("");
                if (!to.isBlank()) {
                    sb.append(" (").append(to).append(")");
                }
            } else {
                sb.append(", settled");
            }
            sb.append("\n");
        }
        sb.append("Totals — received ").append(Inr.format(report.getTotals().getReceived()))
                .append(", sent ").append(Inr.format(report.getTotals().getSent()))
                .append(", you owe ").append(Inr.format(report.getTotals().getOutstanding()))
                .append("\n");
        appendFilterNote(sb, filterNote);
        sb.append("— via IPO Manager");
        return sb.toString();
    }

    private void appendFilterNote(StringBuilder sb, String filterNote) {
        if (filterNote != null && !filterNote.isBlank()) {
            sb.append("[").append(filterNote).append("]\n");
        }
    }

    /**
     * Compact status note for a transaction line, e.g. " · struck off
     * (returned)", " · settled (sold, P&L +₹2,500)". Empty for open legs.
     */
    private String txnStatusNote(TransactionDto t) {
        if (t.isStruck()) {
            if (t.getReturnOfId() != null) {
                return " · return";
            }
            if ("SETTLED_SOLD".equals(t.getStatus())) {
                String note = " · settled (sold";
                if (t.getProfitLoss() != null) {
                    note += ", P&L " + Inr.signed(t.getProfitLoss());
                }
                return note + ")";
            }
            return " · returned";
        }
        if (t.getStatus() == null || "SENT".equals(t.getStatus())) {
            return "";
        }
        return switch (t.getStatus()) {
            case "UNALLOCATED" -> " · unallocated";
            case "ALLOCATED" -> " · allocated";
            default -> "";
        };
    }

    private String statusLabel(String status) {
        return switch (status) {
            case "ALLOTTED" -> "Allotted";
            case "NOT_ALLOTTED" -> "Not Allotted";
            case "APPLIED" -> "Applied";
            case "REFUNDED" -> "Refunded";
            default -> "No application";
        };
    }

    /**
     * Normalizes an Indian phone number for wa.me: strips non-digits and
     * prefixes the 91 country code when given a bare 10-digit number.
     */
    static String normalizePhone(String phone) {
        if (phone == null) {
            throw new IllegalArgumentException(
                    "Person has no phone number on file — cannot send report");
        }
        String digits = phone.replaceAll("\\D", "");
        if (digits.length() == 10) {
            digits = "91" + digits;
        }
        if (digits.isEmpty()) {
            throw new IllegalArgumentException(
                    "Person has no phone number on file — cannot send report");
        }
        return digits;
    }
}
