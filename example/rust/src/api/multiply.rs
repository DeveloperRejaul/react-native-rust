pub fn multiply(a: f64, b: f64) -> f64 {
    a * b
}

#[cfg(test)]
mod tests {
    use super::multiply;

    #[test]
    fn multiplies_values() {
        assert_eq!(multiply(6.0, 7.0), 42.0);
    }
}
