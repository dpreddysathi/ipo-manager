package com.ipomanager.controller;

import com.ipomanager.dto.AuthResponse;
import com.ipomanager.dto.LoginRequest;
import com.ipomanager.dto.RegisterRequest;
import com.ipomanager.dto.UserDto;
import com.ipomanager.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public auth surface — the only /api/** endpoints that don't need a
 * token (see {@code JwtAuthFilter}).
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(
            @Valid @RequestBody RegisterRequest req) {
        return ResponseEntity.status(201).body(authService.register(req));
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req) {
        return authService.login(req);
    }

    /** Who am I — used by the frontend to restore a saved session. */
    @GetMapping("/me")
    public UserDto me() {
        return UserDto.from(authService.me());
    }
}
