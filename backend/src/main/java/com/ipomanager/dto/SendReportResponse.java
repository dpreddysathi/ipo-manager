package com.ipomanager.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Result of POST /api/reports/send. No SMS gateway is configured, so the
 * status is always "manual": the backend built the message server-side and
 * hands back a pre-filled WhatsApp link for the user to send themselves.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SendReportResponse {

    private String status; // "manual"
    private String waLink; // https://wa.me/<digits>?text=<urlencoded>
    private String message; // the plain-text report
}
