package com.ipomanager.dto;

import com.ipomanager.model.AppUser;
import lombok.AllArgsConstructor;
import lombok.Getter;

/** Public shape of the logged-in user (no token, no password hash). */
@Getter
@AllArgsConstructor
public class UserDto {

    private Long id;
    private String name;
    private String email;

    public static UserDto from(AppUser user) {
        return new UserDto(user.getId(), user.getName(), user.getEmail());
    }
}
