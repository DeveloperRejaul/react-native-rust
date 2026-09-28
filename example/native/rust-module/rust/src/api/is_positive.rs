pub fn is_positive(value: f64) -> bool {
    value > 0.0
}

#[cfg(test)]
mod tests {
    use super::is_positive;

    #[test]
    fn compares_number_sign() {
        assert!(is_positive(3.0));
        assert!(!is_positive(-3.0));
    }
}
