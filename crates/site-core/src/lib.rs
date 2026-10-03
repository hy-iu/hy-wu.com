//! site-core —— 站点纯逻辑工具箱（Rust 预留位）。
//!
//! 设计意图：未来把这类纯函数编译到 `wasm32-unknown-unknown`（wasm-pack），
//! 由前端按需异步加载；在那之前只作为普通 crate 维护（`cargo test`）。
//! 不依赖任何运行时设施，保持可移植与可测。

/// 把标题转成 URL 友好的 slug：小写、空白/`-`/`_` 折叠为单个连字符、丢弃非 ASCII。
/// 中文标题会得到空串——调用方应改用拼音或日期型 slug。
pub fn slugify(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut pending_sep = false;
    for ch in input.chars() {
        if ch.is_ascii_alphanumeric() {
            if pending_sep && !out.is_empty() {
                out.push('-');
            }
            pending_sep = false;
            out.push(ch.to_ascii_lowercase());
        } else if ch.is_whitespace() || ch == '-' || ch == '_' {
            pending_sep = !out.is_empty();
        }
        // 其余字符（中文、符号等）丢弃
    }
    out
}

/// 中文为主的阅读时长（分钟）：按每分钟 400 个非空白字符估算，至少 1 分钟。
pub fn reading_minutes(text: &str) -> u32 {
    let chars = text.chars().filter(|c| !c.is_whitespace()).count();
    ((chars as f64 / 400.0).ceil() as u32).max(1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugify_basic() {
        assert_eq!(slugify("Hello World-Foo"), "hello-world-foo");
        assert_eq!(slugify("  trim  me  "), "trim-me");
        assert_eq!(slugify("multi--dash__under"), "multi-dash-under");
    }

    #[test]
    fn slugify_ascii_only() {
        assert_eq!(slugify("把一台 NUC 变成站"), "nuc");
        assert_eq!(slugify("中文"), "");
        assert_eq!(slugify(""), "");
    }

    #[test]
    fn reading_minutes_counts_cjk() {
        assert_eq!(reading_minutes(""), 1);
        assert_eq!(reading_minutes("短文"), 1);
        assert_eq!(reading_minutes(&"字".repeat(800)), 2);
    }
}
