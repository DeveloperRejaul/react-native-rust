#[no_mangle]
pub extern "C" fn add_rust(left: u64, right: u64) -> u64 {
    left + right
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_rust() {
        assert_eq!(add_rust(10, 20), 30);
        assert_eq!(add_rust(5, 5), 10);
    }
}