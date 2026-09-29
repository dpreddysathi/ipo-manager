package com.ipomanager.util;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Formats amounts in Indian digit grouping: 15000 → ₹15,000,
 * 150000 → ₹1,50,000. Used for the plain-text WhatsApp/SMS reports.
 */
public final class Inr {

    private Inr() {
    }

    public static String format(BigDecimal value) {
        if (value == null) {
            value = BigDecimal.ZERO;
        }
        boolean negative = value.signum() < 0;
        String digits = value.abs().setScale(0, RoundingMode.HALF_UP).toPlainString();
        String grouped;
        if (digits.length() <= 3) {
            grouped = digits;
        } else {
            String lastThree = digits.substring(digits.length() - 3);
            String rest = digits.substring(0, digits.length() - 3);
            StringBuilder sb = new StringBuilder();
            while (rest.length() > 2) {
                sb.insert(0, "," + rest.substring(rest.length() - 2));
                rest = rest.substring(0, rest.length() - 2);
            }
            sb.insert(0, rest);
            grouped = sb + "," + lastThree;
        }
        return (negative ? "-₹" : "₹") + grouped;
    }

    /**
     * Like {@link #format(BigDecimal)} but with an explicit sign:
     * +₹2,500 for profit, -₹1,200 for loss.
     */
    public static String signed(BigDecimal value) {
        if (value == null) {
            value = BigDecimal.ZERO;
        }
        if (value.signum() >= 0) {
            return "+" + format(value);
        }
        return format(value);
    }
}
