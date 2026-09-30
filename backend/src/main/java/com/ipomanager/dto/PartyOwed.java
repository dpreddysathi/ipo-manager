package com.ipomanager.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * One outstanding debt between the report's person and a counterparty
 * for an IPO: who, and how much is still owed.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PartyOwed {

    /** Null when the counterparty is you. */
    private Long partyId;
    private String partyName;
    private BigDecimal amount;
}
