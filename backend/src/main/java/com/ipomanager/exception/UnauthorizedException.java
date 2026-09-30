package com.ipomanager.exception;

/** Thrown when there is no logged-in user or the credentials are wrong. */
public class UnauthorizedException extends RuntimeException {

    public UnauthorizedException(String message) {
        super(message);
    }
}
