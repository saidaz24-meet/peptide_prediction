"""
Regression test: Verify Tango percentage metrics are correctly scaled (0-100, not 0-1)
and field mapping is consistent between backend and UI.
"""

def test_tango_percentage_scaling():
    """Verify Tango percentages are in 0-100 range, not double-scaled"""
    import pandas as pd
    from services.normalize import normalize_rows_for_ui
    from tango import process_tango_output
    
    # Create test DataFrame with known Tango results
    df = pd.DataFrame({
        "Entry": ["TEST001"],
        "Sequence": ["ACDEFGHIKLMNPQRSTVWY"],
        "SSW helix percentage": [75.5],  # Should be 0-100 range
        "SSW beta percentage": [20.3],   # Should be 0-100 range
    })
    
    # Normalize to UI format
    rows_out = normalize_rows_for_ui(df, is_single_row=False)
    
    assert len(rows_out) == 1, "Should have one row"
    row = rows_out[0]
    
    # Verify percentages are in 0-100 range (not 0-1)
    ssw_helix = row.get("sswHelixPercentage")
    ssw_beta = row.get("sswBetaPercentage")
    
    assert ssw_helix is not None, "sswHelixPercentage should be present"
    assert ssw_beta is not None, "sswBetaPercentage should be present"
    
    # Verify range: should be 0-100, not 0-1 (if it's 0.755, that's wrong)
    assert 0 <= ssw_helix <= 100, f"sswHelixPercentage should be 0-100, got {ssw_helix}"
    assert 0 <= ssw_beta <= 100, f"sswBetaPercentage should be 0-100, got {ssw_beta}"
    
    # Verify values match (should be ~75.5 and ~20.3, not 0.755 and 0.203)
    assert abs(ssw_helix - 75.5) < 1.0, f"Expected ~75.5, got {ssw_helix} (possible double scaling?)"
    assert abs(ssw_beta - 20.3) < 1.0, f"Expected ~20.3, got {ssw_beta} (possible double scaling?)"
    
    print(f"  ✅ Tango percentages correctly scaled: helix={ssw_helix}%, beta={ssw_beta}% (0-100 range)")


if __name__ == "__main__":
    test_tango_percentage_scaling()
    print("✅ All Tango scaling tests passed")

