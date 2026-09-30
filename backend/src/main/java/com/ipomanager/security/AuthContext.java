package com.ipomanager.security;

import com.ipomanager.exception.UnauthorizedException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Reads the user id the {@link JwtAuthFilter} placed on the current
 * request. Controllers and services call {@link #currentUserId()} instead
 * of taking an explicit parameter, so every query can be scoped to the
 * logged-in user's own rows.
 */
public final class AuthContext {

    public static final String USER_ID_ATTR = "currentUserId";

    private AuthContext() {
    }

    public static Long currentUserId() {
        ServletRequestAttributes attrs =
                (ServletRequestAttributes) RequestContextHolder.currentRequestAttributes();
        HttpServletRequest request = attrs.getRequest();
        Long userId = (Long) request.getAttribute(USER_ID_ATTR);
        if (userId == null) {
            throw new UnauthorizedException("Login required");
        }
        return userId;
    }
}
