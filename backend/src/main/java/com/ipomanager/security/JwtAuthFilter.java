package com.ipomanager.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Gatekeeper for the whole {@code /api/**} surface (except
 * {@code /api/auth/**}, which is how you get a token in the first place).
 *
 * <p>A valid {@code Authorization: Bearer <token>} header puts the user id
 * on the request (see {@link AuthContext}); anything else gets a plain
 * 401 JSON response.
 */
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain)
            throws ServletException, IOException {
        if (request.getRequestURI().startsWith("/api/auth/")) {
            chain.doFilter(request, response);
            return;
        }
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            final Long userId;
            try {
                userId = jwtService.parseUserId(header.substring(7).trim());
            } catch (Exception e) {
                // Bad signature / expired / malformed token.
                writeUnauthorized(response);
                return;
            }
            request.setAttribute(AuthContext.USER_ID_ATTR, userId);
            // Downstream exceptions propagate normally — they are not
            // authentication failures and must not be masked as 401.
            chain.doFilter(request, response);
            return;
        }
        writeUnauthorized(response);
    }

    private static void writeUnauthorized(HttpServletResponse response)
            throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"unauthorized: login required\"}");
    }
}
