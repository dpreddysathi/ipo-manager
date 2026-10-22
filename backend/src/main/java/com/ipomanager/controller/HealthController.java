package com.ipomanager.controller;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public liveness probe (outside /api/**, so the JWT filter does not guard it).
 * Used by the uptime pinger to keep the hosted instance awake and to detect outages.
 * Returns no data — just proof the app is up.
 */
@RestController
public class HealthController {

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }
}
