package com.ipomanager.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

/** Returned by register/login: the token plus who it belongs to. */
@Getter
@AllArgsConstructor
public class AuthResponse {

    private String token;
    private Long id;
    private String name;
    private String email;
}
