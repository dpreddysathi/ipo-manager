package com.ipomanager.repository;

import com.ipomanager.model.Person;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PersonRepository extends JpaRepository<Person, Long> {

    List<Person> findByOwnerId(Long ownerId);

    Optional<Person> findByIdAndOwnerId(Long id, Long ownerId);

    long countByOwnerId(Long ownerId);

    /**
     * Adopts rows created before multi-user auth existed (ownerless) into
     * the first registered account.
     */
    @Modifying
    @Query("update Person p set p.ownerId = :ownerId where p.ownerId is null")
    void claimOrphans(@Param("ownerId") Long ownerId);
}
