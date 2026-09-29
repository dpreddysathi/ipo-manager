package com.ipomanager.controller;

import com.ipomanager.dto.AllotmentDto;
import com.ipomanager.dto.DashboardStatsDto;
import com.ipomanager.dto.ProfitLossReportDto;
import com.ipomanager.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/stats")
    public DashboardStatsDto stats() {
        return dashboardService.stats();
    }

    /** All allotted applications — which IPO, for whom, and when. */
    @GetMapping("/allotments")
    public List<AllotmentDto> allotments() {
        return dashboardService.allotments();
    }

    /**
     * Realized profit &amp; loss. {@code period} is one of
     * {@code 1W}, {@code 1M}, {@code 3M}, {@code 6M}, {@code MTD}
     * (month to date), {@code ALL} (default {@code ALL}).
     */
    @GetMapping("/profit-loss")
    public ProfitLossReportDto profitLoss(
            @RequestParam(defaultValue = "ALL") String period) {
        return dashboardService.profitLoss(period);
    }
}
