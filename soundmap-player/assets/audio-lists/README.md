# Audio File Lists

Place `.txt` files in this directory containing lists of R2 audio file URLs.

## Format

Each file can contain URLs in one of two formats:

**Line-separated (one URL per line):**
```
https://pub-xxx.r2.dev/file1.mp3
https://pub-xxx.r2.dev/file2.wav
https://pub-xxx.r2.dev/file3.mp3
```

**Comma-separated (all on one line):**
```
https://pub-xxx.r2.dev/file1.mp3, https://pub-xxx.r2.dev/file2.wav, https://pub-xxx.r2.dev/file3.mp3
```

## Example Files

- `default.txt` - Default audio files
- `notes.txt` - Notes/voice recordings
- `custom.txt` - Custom audio collection

The tool will automatically detect and load these files when you select "From R2 Bucket" as the audio source.

