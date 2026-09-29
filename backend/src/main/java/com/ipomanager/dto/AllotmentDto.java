package com.ipomanager.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * One allotted application: which IPO, for whom, and when the allotment
 * was confirmed. Backs the dashboard's "Allotments" section.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AllotmentDto {

    private Long applicationId;
    private Long ipoId;
    private String ipoName;
    private Long personId;
    private String personName;
    private BigDecimal amount;
    private Integer lots;
    private LocalDateTime allottedAt;
}
