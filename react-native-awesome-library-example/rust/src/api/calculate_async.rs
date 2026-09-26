pub fn calculate_async(value: f64) -> Result<f64, String> {
    if !value.is_finite() {
        return Err("Input must be a finite number".to_string());
    }
    Ok(value * 2.0)
}
