package com.ipomanager.service;

import com.ipomanager.dto.AllotmentDto;
import com.ipomanager.dto.DashboardStatsDto;
import com.ipomanager.dto.ProfitLossReportDto;
import com.ipomanager.model.Application;
import com.ipomanager.model.ApplicationStatus;
import com.ipomanager.model.IpoStatus;
import com.ipomanager.model.Transaction;
import com.ipomanager.model.TxnDirection;
import com.ipomanager.repository.ApplicationRepository;
import com.ipomanager.repository.IpoRepository;
import com.ipomanager.repository.PersonRepository;
import com.ipomanager.repository.TransactionRepository;
import com.ipomanager.security.AuthContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final IpoRepository ipoRepository;
    private final PersonRepository personRepository;
    private final TransactionRepository transactionRepository;
    private final ApplicationRepository applicationRepository;

    @Transactional(readOnly = true)
    public DashboardStatsDto stats() {
        Long userId = AuthContext.currentUserId();
        BigDecimal totalReceived =
                transactionRepository.sumByOwnerIdAndDirection(userId, TxnDirection.RECEIVED);
        BigDecimal totalSent =
                transactionRepository.sumByOwnerIdAndDirection(userId, TxnDirection.SENT);

        List<Transaction> pending = transactionRepository.findPendingSettlements(
                userId, TxnDirection.RECEIVED, List.of(IpoStatus.CLOSED, IpoStatus.LISTED));
        BigDecimal pendingTotal = pending.stream()
                .map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        LocalDateTime yearStart = LocalDate.now().withDayOfYear(1).atStartOfDay();
        LocalDateTime now = LocalDateTime.now();
        long appsThisYear = applicationRepository
                .countByOwnerIdAndCreatedAtBetween(userId, yearStart, now);
        long allottedThisYear = applicationRepository
                .countByOwnerIdAndStatusAndCreatedAtBetween(
                        userId, ApplicationStatus.ALLOTTED, yearStart, now);
        double rate = appsThisYear == 0 ? 0.0
                : BigDecimal.valueOf(100.0 * allottedThisYear / appsThisYear)
                        .setScale(1, RoundingMode.HALF_UP).doubleValue();

        return new DashboardStatsDto(
                ipoRepository.countByOwnerIdAndStatus(userId, IpoStatus.OPEN),
                totalReceived,
                personRepository.countByOwnerId(userId),
                totalReceived.subtract(totalSent),
                new DashboardStatsDto.PendingSettlements(pending.size(), pendingTotal),
                rate);
    }

    /**
     * Every allotted application: which IPO, for whom, and when the
     * allotment was confirmed. Newest first.
     */
    @Transactional(readOnly = true)
    public List<AllotmentDto> allotments() {
        return applicationRepository.findByOwnerId(AuthContext.currentUserId()).stream()
                .filter(a -> a.getStatus() == ApplicationStatus.ALLOTTED)
                .sorted(Comparator.comparing(Application::getAllottedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(a -> new AllotmentDto(
                        a.getId(),
                        a.getIpo().getId(),
                        a.getIpo().getName(),
                        a.getPerson().getId(),
                        a.getPerson().getName(),
                        a.getAppliedAmount(),
                        a.getLots(),
                        a.getAllottedAt()))
                .toList();
    }

    /**
     * Realized profit &amp; loss for a period: {@code 1W}, {@code 1M},
     * {@code 3M}, {@code 6M}, {@code MTD} (month to date) or {@code ALL}.
     * Only applications with a recorded profit/loss whose sale date falls
     * in the period are counted.
     */
    @Transactional(readOnly = true)
    public ProfitLossReportDto profitLoss(String period) {
        LocalDateTime cutoff = switch (period == null ? "ALL" : period.toUpperCase()) {
            case "1W" -> LocalDateTime.now().minusWeeks(1);
            case "1M" -> LocalDateTime.now().minusMonths(1);
            case "3M" -> LocalDateTime.now().minusMonths(3);
            case "6M" -> LocalDateTime.now().minusMonths(6);
            case "MTD" -> LocalDate.now().withDayOfMonth(1).atStartOfDay();
            default -> null;
        };

        List<ProfitLossReportDto.Entry> entries = applicationRepository
                .findByOwnerId(AuthContext.currentUserId()).stream()
                .filter(a -> a.getProfitLoss() != null && a.getSoldAt() != null)
                .filter(a -> cutoff == null || !a.getSoldAt().isBefore(cutoff))
                .sorted(Comparator.comparing(Application::getSoldAt).reversed())
                .map(a -> new ProfitLossReportDto.Entry(
                        a.getId(),
                        a.getIpo().getId(),
                        a.getIpo().getName(),
                        a.getPerson().getId(),
                        a.getPerson().getName(),
                        a.getAppliedAmount(),
                        a.getProfitLoss(),
                        a.getSoldAt()))
                .toList();

        BigDecimal total = entries.stream()
                .map(ProfitLossReportDto.Entry::getProfitLoss)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new ProfitLossReportDto(
                total, entries,
                bucket(entries, ProfitLossReportDto.Entry::getIpoName),
                bucket(entries, ProfitLossReportDto.Entry::getPersonName));
    }

    private List<ProfitLossReportDto.Bucket> bucket(
            List<ProfitLossReportDto.Entry> entries,
            java.util.function.Function<ProfitLossReportDto.Entry, String> key) {
        Map<String, List<ProfitLossReportDto.Entry>> grouped = new LinkedHashMap<>();
        for (ProfitLossReportDto.Entry e : entries) {
            grouped.computeIfAbsent(key.apply(e), k -> new ArrayList<>()).add(e);
        }
        return grouped.entrySet().stream()
                .map(en -> new ProfitLossReportDto.Bucket(
                        en.getKey(),
                        en.getValue().stream()
                                .map(ProfitLossReportDto.Entry::getProfitLoss)
                                .reduce(BigDecimal.ZERO, BigDecimal::add),
                        en.getValue().size()))
                .sorted(Comparator.comparing(ProfitLossReportDto.Bucket::getTotal).reversed())
                .toList();
    }
}
