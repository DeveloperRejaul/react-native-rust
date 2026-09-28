pub fn calculate_async(value: f64) -> Result<f64, String> {
    if !value.is_finite() {
        return Err("Input must be a finite number".to_string());
    }
    Ok(value * 2.0)
}

#[cfg(test)]
mod tests {
    use super::calculate_async;

    #[test]
    fn doubles_value_and_rejects_non_finite_input() {
        assert_eq!(calculate_async(21.0), Ok(42.0));
        assert!(calculate_async(f64::INFINITY).is_err());
    }
}
