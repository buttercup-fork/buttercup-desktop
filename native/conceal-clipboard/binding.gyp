{
    "targets": [
        {
            "target_name": "conceal_clipboard",
            "sources": ["src/conceal.c"],
            "conditions": [
                ["OS=='win'", { "libraries": ["user32.lib"] }]
            ]
        }
    ]
}
