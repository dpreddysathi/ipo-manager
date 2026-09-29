package com.ipomanager.repository;

import com.ipomanager.model.Ipo;
import com.ipomanager.model.IpoStatus;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IpoRepository extends JpaRepository<Ipo, Long> {

    long countByStatus(IpoStatus status);
}
