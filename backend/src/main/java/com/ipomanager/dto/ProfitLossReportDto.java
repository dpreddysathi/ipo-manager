package com.ipomanager.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Profit &amp; loss report over a selectable period: the total realized
 * P&amp;L plus per-IPO and per-person breakdowns and the individual sale
 * entries. Backs the dashboard's "Profit &amp; Loss" section and its
 * 1W / 1M / 3M / 6M / All filters.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ProfitLossReportDto {

    private BigDecimal total;
    private List<Entry> entries;
    private List<Bucket> byIpo;
    private List<Bucket> byPerson;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Entry {
        private Long applicationId;
        private Long ipoId;
        private String ipoName;
        private Long personId;
        private String personName;
        private BigDecimal amount;
        private BigDecimal profitLoss;
        private LocalDateTime soldAt;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Bucket {
        private String name;
        private BigDecimal total;
        private int count;
    }
}
