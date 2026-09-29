package com.ipomanager.repository;

import com.ipomanager.model.PersonKyc;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PersonKycRepository extends JpaRepository<PersonKyc, Long> {

    Optional<PersonKyc> findByPersonId(Long personId);
}
