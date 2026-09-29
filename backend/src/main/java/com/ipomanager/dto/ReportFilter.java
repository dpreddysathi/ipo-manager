package com.ipomanager.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/**
 * Optional filters for a person report — used by the drawer preview
 * ({@code GET /api/people/{id}/report}) and by the WhatsApp send
 * ({@code POST /api/reports/send}) so the message always matches what
 * the drawer showed.
 */
@Getter
@Setter
@NoArgsConstructor
public class ReportFilter {

    /** When false, rows that are fully settled (held == 0) are omitted. */
    private boolean includeSettled = false;

    /** When true, only IPOs with no allotted application are included. */
    private boolean onlyUnallotted = false;

    /** Optional date window applied to transactions and applications. */
    private LocalDate fromDate;

    /** Optional date window applied to transactions and applications. */
    private LocalDate toDate;

    public boolean hasDateWindow() {
        return fromDate != null || toDate != null;
    }

    /** Human-readable summary appended to the sent message, e.g.
     * "only unsettled · 1 Sep – 30 Sep". Empty when no filters are active. */
    public String describe() {
        StringBuilder sb = new StringBuilder();
        if (!includeSettled) {
            sb.append("only unsettled");
        }
        if (onlyUnallotted) {
            if (sb.length() > 0) {
                sb.append(" · ");
            }
            sb.append("no allotment yet");
        }
        if (hasDateWindow()) {
            if (sb.length() > 0) {
                sb.append(" · ");
            }
            sb.append(fromDate != null ? fromDate.toString() : "…")
                    .append(" – ")
                    .append(toDate != null ? toDate.toString() : "…");
        }
        return sb.toString();
    }
}
