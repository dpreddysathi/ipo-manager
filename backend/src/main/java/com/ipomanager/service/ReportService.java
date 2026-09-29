package com.ipomanager.service;

import com.ipomanager.dto.ApplicationDto;
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
import com.ipomanager.model.TxnDirection;
import com.ipomanager.repository.ApplicationRepository;
import com.ipomanager.repository.IpoRepository;
import com.ipomanager.repository.PersonRepository;
import com.ipomanager.repository.ReportLogRepository;
import com.ipomanager.repository.TransactionRepository;
import com.ipomanager.util.Inr;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * Builds person reports (the data behind the Person Report Drawer) and the
 * plain-text report messages sent via {@code POST /api/reports/send}.
 *
 * <p>The message is always built server-side from the report data — the
 * client never supplies message text. No SMS gateway is configured, so
 * sending returns a pre-filled {@code wa.me} link (status "manual") and a
 * {@link ReportLog} row is persisted for the audit trail.
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
        Person person = personRepository.findById(personId)
                .orElseThrow(() -> new ResourceNotFoundException("Person", personId));

        final List<Ipo> ipos;
        if (ipoId != null) {
            Ipo ipo = ipoRepository.findById(ipoId)
                    .orElseThrow(() -> new ResourceNotFoundException("Ipo", ipoId));
            ipos = List.of(ipo);
        } else {
            Set<Long> ids = new LinkedHashSet<>();
            transactionRepository.findByPersonId(personId)
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
        BigDecimal totalSentBack = rows.stream()
                .map(PersonReportRow::getSentBack).reduce(BigDecimal.ZERO, BigDecimal::add);

        return new PersonReportDto(
                person, rows,
                new PersonReportDto.ReportTotals(
                        totalApplied, totalReceived, totalSentBack,
                        totalReceived.subtract(totalSentBack)));
    }

    /**
     * Builds one IPO row for a person, or {@code null} when the row is
     * excluded by the active filters.
     */
    private PersonReportRow buildRow(Long personId, Ipo ipo, ReportFilter filter) {
        List<Transaction> txns = filteredTxns(personId, ipo.getId(), filter);
        BigDecimal received = sum(txns, TxnDirection.RECEIVED);
        BigDecimal sentBack = sum(txns, TxnDirection.SENT);

        List<Application> applications = filteredApps(personId, ipo.getId(), filter);
        BigDecimal applied = applications.stream()
                .map(Application::getAppliedAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal held = received.subtract(sentBack);

        if (!filter.isIncludeSettled() && held.signum() == 0
                && received.signum() == 0 && sentBack.signum() == 0
                && applied.signum() == 0) {
            return null;
        }
        if (filter.isOnlyUnallotted()
                && applications.stream().anyMatch(a -> a.getStatus() == ApplicationStatus.ALLOTTED)) {
            return null;
        }
        if (filter.hasDateWindow()
                && received.signum() == 0 && sentBack.signum() == 0 && applied.signum() == 0) {
            return null;
        }

        List<ApplicationDto> applicationDtos = applications.stream()
                .map(ApplicationDto::from)
                .toList();
        List<TransactionDto> txnDtos = txns.stream()
                .sorted(Comparator.comparing(Transaction::getTxnDate,
                        Comparator.nullsLast(Comparator.naturalOrder())).reversed())
                .map(TransactionDto::from)
                .toList();
        return new PersonReportRow(
                ipo.getId(), ipo.getName(), applied, received, sentBack,
                held, deriveStatus(applications),
                applicationDtos, txnDtos);
    }

    private List<Transaction> filteredTxns(Long personId, Long ipoId, ReportFilter filter) {
        return transactionRepository.findByPersonIdAndIpoId(personId, ipoId).stream()
                .filter(t -> filter.isIncludeSettled() || !t.isSettled())
                .filter(t -> inWindow(t.getTxnDate(), filter))
                .toList();
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

    private BigDecimal sum(List<Transaction> txns, TxnDirection direction) {
        return txns.stream()
                .filter(t -> t.getDirection() == direction)
                .map(Transaction::getAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
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
        Long personId = request.getPersonId();
        Long ipoId = request.getIpoId();
        Person person = personRepository.findById(personId)
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
                List<Transaction> txns = filteredTxns(personId, ipoId, filter);
                List<Application> applications = filteredApps(personId, ipoId, filter);
                List<Transaction> receivedTxns = txns.stream()
                        .filter(t -> t.getDirection() == TxnDirection.RECEIVED)
                        .sorted(Comparator.comparing(Transaction::getTxnDate,
                                Comparator.nullsLast(Comparator.naturalOrder())))
                        .toList();
                List<Transaction> sentTxns = txns.stream()
                        .filter(t -> t.getDirection() == TxnDirection.SENT)
                        .sorted(Comparator.comparing(Transaction::getTxnDate,
                                Comparator.nullsLast(Comparator.naturalOrder())))
                        .toList();
                message = singleIpoMessage(person, row.get(), applications,
                        receivedTxns, sentTxns, filterNote);
            }
        } else {
            message = allIposMessage(person, report, filterNote);
        }

        String digits = normalizePhone(person.getPhone());
        String waLink = "https://wa.me/" + digits
                + "?text=" + URLEncoder.encode(message, StandardCharsets.UTF_8);

        ReportLog entry = new ReportLog();
        entry.setPerson(person);
        entry.setIpo(ipoId != null ? ipoRepository.findById(ipoId).orElse(null) : null);
        entry.setChannel("whatsapp");
        entry.setSentTo(digits);
        entry.setSentAt(LocalDateTime.now());
        entry.setStatus("manual");
        reportLogRepository.save(entry);

        return new SendReportResponse("manual", waLink, message);
    }

    private String singleIpoMessage(Person person, PersonReportRow row,
                                    List<Application> applications,
                                    List<Transaction> receivedTxns,
                                    List<Transaction> sentTxns,
                                    String filterNote) {
        StringBuilder sb = new StringBuilder();
        sb.append("Hi ").append(person.getName())
                .append(", your ").append(row.getIpoName()).append(" IPO summary:\n");

        sb.append("Applied: ").append(Inr.format(row.getApplied())).append("\n");
        sb.append("Status: ").append(statusLabel(row.getStatus())).append("\n");

        if (!receivedTxns.isEmpty()) {
            sb.append("Received:\n");
            for (Transaction t : receivedTxns) {
                sb.append("  ").append(Inr.format(t.getAmount()));
                if (t.getTxnDate() != null) {
                    sb.append(" on ").append(t.getTxnDate().format(DAY_MONTH_TIME));
                }
                sb.append(txnStatusNote(t));
                sb.append("\n");
            }
        }

        BigDecimal refund = applications.stream()
                .map(Application::getRefundAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (refund.signum() > 0) {
            sb.append("Refund from exchange: ").append(Inr.format(refund)).append("\n");
        }

        if (row.getSentBack().signum() > 0) {
            sb.append("Sent back to you: ").append(Inr.format(row.getSentBack()));
            if (!sentTxns.isEmpty() && sentTxns.get(sentTxns.size() - 1).getTxnDate() != null) {
                sb.append(" on ").append(
                        sentTxns.get(sentTxns.size() - 1).getTxnDate().format(DAY_MONTH_TIME));
            }
            sb.append("\n");
        }

        BigDecimal held = row.getHeld();
        sb.append("Balance: ").append(Inr.format(held)).append(" — ");
        int cmp = held.compareTo(BigDecimal.ZERO);
        if (cmp == 0) {
            sb.append("settled.");
        } else if (cmp > 0) {
            sb.append("pending.");
        } else {
            sb.append("overpaid.");
        }
        sb.append("\n");
        appendFilterNote(sb, filterNote);
        sb.append("— via IPO Manager");
        return sb.toString();
    }

    private String allIposMessage(Person person, PersonReportDto report, String filterNote) {
        StringBuilder sb = new StringBuilder();
        sb.append("Hi ").append(person.getName()).append(", your IPO summary:\n");
        for (PersonReportRow row : report.getIpos()) {
            sb.append("- ").append(row.getIpoName())
                    .append(": applied ").append(Inr.format(row.getApplied()))
                    .append(", received ").append(Inr.format(row.getReceived()));
            if (row.getTransactions() != null && !row.getTransactions().isEmpty()) {
                String when = row.getTransactions().stream()
                        .filter(t -> "RECEIVED".equals(t.getDirection()) && t.getDate() != null)
                        .limit(3)
                        .map(t -> t.getDate().format(DAY_MONTH_TIME))
                        .collect(java.util.stream.Collectors.joining("; "));
                if (!when.isBlank()) {
                    sb.append(" (").append(when).append(")");
                }
            }
            sb.append(", ").append(statusLabel(row.getStatus()))
                    .append(", balance ").append(Inr.format(row.getHeld()))
                    .append("\n");
        }
        sb.append("Totals — received ").append(Inr.format(report.getTotals().getReceived()))
                .append(", sent back ").append(Inr.format(report.getTotals().getSentBack()))
                .append(", held ").append(Inr.format(report.getTotals().getHeld()))
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
     * Compact status note for a transaction line in the WhatsApp message,
     * e.g. " · unallocated", " · settled (refund)",
     * " · settled (sold, P&L +₹2,500)". Empty for plain in-flight money.
     */
    private String txnStatusNote(Transaction t) {
        if (t.getStatus() == null || t.getStatus() == TxnStatus.SENT) {
            return "";
        }
        switch (t.getStatus()) {
            case UNALLOCATED:
                return " · unallocated";
            case ALLOCATED:
                return " · allocated";
            case SETTLED_UNALLOCATED:
                return " · settled (refund)";
            case SETTLED_SOLD: {
                String note = " · settled (sold";
                if (t.getProfitLoss() != null) {
                    note += ", P&L " + Inr.signed(t.getProfitLoss());
                }
                return note + ")";
            }
            default:
                return "";
        }
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
