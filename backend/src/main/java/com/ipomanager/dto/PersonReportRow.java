package com.ipomanager.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;

/**
 * One row of a person report: a single IPO's money picture for one person.
 * held = received − sentBack (positive means you still hold / owe it).
 * The row also carries the person's applications for that IPO, which the
 * frontend uses to derive the allotment verdict.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PersonReportRow {

    private Long ipoId;
    private String ipoName;
    private BigDecimal applied;
    private BigDecimal received;
    private BigDecimal sentBack;
    private BigDecimal held;
    /** ALLOTTED | NOT_ALLOTTED | APPLIED | REFUNDED | NO_APPLICATION */
    private String status;
    private List<ApplicationDto> applications;
    /** The transactions behind this row (same filters applied), newest first. */
    private List<TransactionDto> transactions;
}
