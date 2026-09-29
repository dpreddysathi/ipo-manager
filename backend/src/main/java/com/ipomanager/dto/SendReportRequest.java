package com.ipomanager.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class SendReportRequest {

    @NotNull(message = "personId is required")
    private Long personId;

    /** Optional — null means an "all IPOs" report. */
    private Long ipoId;

    /** Optional report filters — see {@link ReportFilter}. */
    private Boolean includeSettled;

    private Boolean onlyUnallotted;

    private java.time.LocalDate fromDate;

    private java.time.LocalDate toDate;

    public ReportFilter toFilter() {
        ReportFilter filter = new ReportFilter();
        if (includeSettled != null) {
            filter.setIncludeSettled(includeSettled);
        }
        if (onlyUnallotted != null) {
            filter.setOnlyUnallotted(onlyUnallotted);
        }
        filter.setFromDate(fromDate);
        filter.setToDate(toDate);
        return filter;
    }
}
