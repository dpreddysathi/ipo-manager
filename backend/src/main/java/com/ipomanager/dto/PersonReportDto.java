package com.ipomanager.dto;

import com.ipomanager.model.Person;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;

/**
 * The data behind the Person Report Drawer (§4.3 of the spec).
 * Shape matches the frontend's {@code PersonReport} type:
 * the person, one row per IPO, and overall totals.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PersonReportDto {

    private Person person;
    private List<PersonReportRow> ipos;
    private ReportTotals totals;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReportTotals {
        private BigDecimal applied;
        private BigDecimal received;
        private BigDecimal sentBack;
        private BigDecimal held;
    }
}
