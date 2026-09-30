package com.ipomanager.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;

/**
 * One row of a person report: a single IPO's money picture for one person.
 *
 * <p>Every movement lists who sent to whom. {@code owes} is who this
 * person still owes (and how much); {@code owedBy} is who still owes this
 * person. Returned legs are struck off ({@link TransactionDto#isStruck}).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PersonReportRow {

    private Long ipoId;
    private String ipoName;
    private BigDecimal applied;
    /** ALLOTTED | NOT_ALLOTTED | APPLIED | REFUNDED | NO_APPLICATION */
    private String status;
    private List<ApplicationDto> applications;
    /** The person's movements for this IPO (same filters applied), newest first. */
    private List<TransactionDto> transactions;
    /** Counterparties this person still owes, with amounts. */
    private List<PartyOwed> owes;
    /** Counterparties that still owe this person, with amounts. */
    private List<PartyOwed> owedBy;
    /** Total received (as receiver) under the active filters. */
    private BigDecimal received;
    /** Total sent (as sender, including returns) under the active filters. */
    private BigDecimal sent;
    /** Total still owed by this person under the active filters. */
    private BigDecimal outstanding;
}
