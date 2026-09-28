pub fn greet(name: String) -> String {
    format!("Hello, {name}!")
}

#[cfg(test)]
mod tests {
    use super::greet;

    #[test]
    fn returns_greeting() {
        assert_eq!(greet("Ada".to_string()), "Hello, Ada!");
    }
}
