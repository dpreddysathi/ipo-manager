package com.ipomanager;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class IpoManagerApplication {

    public static void main(String[] args) {
        SpringApplication.run(IpoManagerApplication.class, args);
    }
}
