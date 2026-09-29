package com.ipomanager.controller;

import com.ipomanager.dto.SendReportRequest;
import com.ipomanager.dto.SendReportResponse;
import com.ipomanager.service.ReportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    /**
     * Builds the report message server-side and returns a pre-filled
     * WhatsApp link (no SMS gateway is configured — status is "manual").
     * A ReportLog row is persisted for the audit trail.
     */
    @PostMapping("/send")
    public SendReportResponse send(@Valid @RequestBody SendReportRequest request) {
        return reportService.sendReport(request);
    }
}
