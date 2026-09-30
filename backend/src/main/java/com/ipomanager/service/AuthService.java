package com.ipomanager.service;

import at.favre.lib.crypto.bcrypt.BCrypt;
import com.ipomanager.dto.AuthResponse;
import com.ipomanager.dto.LoginRequest;
import com.ipomanager.dto.RegisterRequest;
import com.ipomanager.exception.UnauthorizedException;
import com.ipomanager.model.AppUser;
import com.ipomanager.repository.ApplicationRepository;
import com.ipomanager.repository.AppUserRepository;
import com.ipomanager.repository.IpoRepository;
import com.ipomanager.repository.PersonRepository;
import com.ipomanager.repository.TransactionRepository;
import com.ipomanager.security.AuthContext;
import com.ipomanager.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Register / login. Passwords are BCrypt-hashed (cost 12); the raw
 * password is never stored or logged.
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private final AppUserRepository userRepository;
    private final JwtService jwtService;
    private final PersonRepository personRepository;
    private final IpoRepository ipoRepository;
    private final TransactionRepository transactionRepository;
    private final ApplicationRepository applicationRepository;

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        String email = req.getEmail().trim().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException(
                    "An account with this email already exists — try logging in instead");
        }
        // The very first account adopts the rows created before multi-user
        // auth existed (the single-user era). Later accounts start empty.
        boolean firstUser = userRepository.count() == 0;

        AppUser user = new AppUser();
        user.setName(req.getName().trim());
        user.setEmail(email);
        user.setPasswordHash(BCrypt.withDefaults()
                .hashToString(12, req.getPassword().toCharArray()));
        userRepository.save(user);

        if (firstUser) {
            personRepository.claimOrphans(user.getId());
            ipoRepository.claimOrphans(user.getId());
            transactionRepository.claimOrphans(user.getId());
            applicationRepository.claimOrphans(user.getId());
        }
        return new AuthResponse(jwtService.createToken(user.getId()),
                user.getId(), user.getName(), user.getEmail());
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest req) {
        String email = req.getEmail().trim().toLowerCase();
        AppUser user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException("Invalid email or password"));
        BCrypt.Result result = BCrypt.verifyer()
                .verify(req.getPassword().toCharArray(), user.getPasswordHash());
        if (!result.verified) {
            throw new UnauthorizedException("Invalid email or password");
        }
        return new AuthResponse(jwtService.createToken(user.getId()),
                user.getId(), user.getName(), user.getEmail());
    }

    @Transactional(readOnly = true)
    public AppUser me() {
        return userRepository.findById(AuthContext.currentUserId())
                .orElseThrow(() -> new UnauthorizedException("Login required"));
    }
}
