# How to Export Wix CMS Data to JSON for Audio Builder

This guide shows you how to get your audio files and data from Wix CMS into the JSON format needed for the builder.

## Method 1: Manual Export (Easiest - No Code Required)

### Step 1: Access Your Wix CMS Collection

1. Go to your **Wix Editor**
2. Click on **CMS** (Content Management System) in the left sidebar
3. Select your audio tracks collection (or create one if needed)

### Step 2: Set Up Your CMS Collection Fields

Your collection should have these fields:
- **Audio File** (Media field) - Required
- **Title** (Text field) - Optional but recommended
- **Color** (Text field) - Optional, for custom colors (format: "#4CAF50")

### Step 3: Export Data Manually

**Option A: Copy-Paste Method**
1. In your CMS collection, view all items in a table/grid view
2. For each item, note:
   - The audio file URL (right-click → Copy Link)
   - The title
   - The color (if you set one)
3. Create a JSON array manually:

```json
[
  {
    "url": "https://static.wixstatic.com/media/abc123-track1.mp3",
    "title": "Ambient Soundscape",
    "color": "#4CAF50"
  },
  {
    "url": "https://static.wixstatic.com/media/def456-track2.mp3",
    "title": "Nature Sounds",
    "color": "#2196F3"
  },
  {
    "url": "https://static.wixstatic.com/media/ghi789-track3.mp3",
    "title": "Ocean Waves",
    "color": "#FF9800"
  }
]
```

**Option B: Use Wix Export Feature**
1. In CMS collection, click the **three dots** (⋯) menu
2. Look for **Export** or **Download** option
3. Export as CSV or JSON (if available)
4. Convert to the required format if needed

### Step 4: Get Audio File URLs

For each audio file in your CMS:

1. **In Wix Media Manager:**
   - Go to **Media** → **My Uploads**
   - Find your audio file
   - Right-click → **Copy Link**
   - You'll get a URL like: `https://static.wixstatic.com/media/abc123-yourfile.mp3`

2. **Or from CMS Collection:**
   - Click on the audio file field
   - Right-click the file → **Copy Link**
   - Use this URL in your JSON

### Step 5: Use in Builder

1. Open `builder.html`
2. Click **"Load from Wix CMS"** button
3. Paste your JSON into the textarea
4. Click **"Load from CMS Data"**
5. Click on the canvas to place your sources

---

## Method 2: Using Wix HTTP Functions (Automated - Recommended)

This method creates an API endpoint that returns your CMS data in the correct format.

### Step 1: Create a Wix HTTP Function

1. In Wix Editor, go to **Dev Mode** (or **Code** section)
2. Click **Backend** → **HTTP Functions**
3. Click **+ New** → **HTTP Function**
4. Name it: `getAudioTracks`

### Step 2: Write the Function Code

```javascript
import wixData from 'wix-data';

export async function get_audioTracks(request) {
  try {
    // Replace 'AudioTracks' with your collection name
    const results = await wixData.query('AudioTracks')
      .find();
    
    // Transform CMS data to builder format
    const tracks = results.items.map(item => {
      // Get audio file URL
      let audioUrl = '';
      if (item.audioFile && item.audioFile.url) {
        audioUrl = item.audioFile.url;
      } else if (item.audioFile && typeof item.audioFile === 'string') {
        audioUrl = item.audioFile;
      }
      
      return {
        url: audioUrl,
        title: item.title || item.name || 'Untitled',
        color: item.color || null
      };
    });
    
    return {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: tracks
    };
  } catch (error) {
    return {
      status: 500,
      body: { error: error.message }
    };
  }
}
```

### Step 3: Deploy the Function

1. Save the function
2. Publish your site
3. Get your function URL (shown in the HTTP Functions panel)
   - Format: `https://your-site.wixsite.com/_functions/api/getAudioTracks`

### Step 4: Use in Builder

1. Open `builder.html`
2. Click **"Load from Wix CMS"** button
3. Click **"Load from CMS URL"** button
4. Enter your function URL: `https://your-site.wixsite.com/_functions/api/getAudioTracks`
5. Click **"Fetch from URL"**
6. The data will be loaded automatically!

---

## Method 3: Using Wix Data API (Advanced)

If you want to fetch data from outside Wix or create a custom export tool.

### Step 1: Enable Data API

1. Go to **Settings** → **Advanced** → **Data API**
2. Enable **Data API** for your collection
3. Note your **Collection ID**

### Step 2: Create Export Script

You can create a simple HTML page that fetches and formats the data:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Wix CMS Export Tool</title>
</head>
<body>
    <h1>Export Audio Tracks</h1>
    <button onclick="exportTracks()">Export to JSON</button>
    <pre id="output"></pre>

    <script>
        async function exportTracks() {
            // Replace with your actual API endpoint
            const apiUrl = 'https://your-site.wixsite.com/_functions/api/getAudioTracks';
            
            try {
                const response = await fetch(apiUrl);
                const data = await response.json();
                
                // Format as JSON string
                const jsonString = JSON.stringify(data, null, 2);
                
                // Display and copy
                document.getElementById('output').textContent = jsonString;
                
                // Copy to clipboard
                navigator.clipboard.writeText(jsonString);
                alert('JSON copied to clipboard!');
            } catch (error) {
                console.error('Error:', error);
                alert('Error fetching data: ' + error.message);
            }
        }
    </script>
</body>
</html>
```

---

## Method 4: Using Wix Velo (Site Code)

If you want to add a button on your Wix site that exports the data.

### Step 1: Add a Button to Your Page

1. Add a **Button** element to your page
2. Set the button text: "Export Audio Tracks"

### Step 2: Add Page Code

In **Page Code** (or **Site Code**), add:

```javascript
import wixData from 'wix-data';

export function button1_click(event) {
  exportAudioTracks();
}

async function exportAudioTracks() {
  try {
    const results = await wixData.query('AudioTracks')
      .find();
    
    const tracks = results.items.map(item => ({
      url: item.audioFile?.url || '',
      title: item.title || item.name || 'Untitled',
      color: item.color || null
    }));
    
    // Create JSON string
    const jsonString = JSON.stringify(tracks, null, 2);
    
    // Create download link
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audio-tracks.json';
    a.click();
    URL.revokeObjectURL(url);
    
    console.log('Export complete!');
  } catch (error) {
    console.error('Export error:', error);
  }
}
```

---

## CMS Collection Setup Example

Here's how to set up your CMS collection:

### Collection Name: `AudioTracks`

**Fields:**
1. **`audioFile`** (Media)
   - Type: Media
   - Required: Yes
   - Description: The audio file

2. **`title`** (Text)
   - Type: Text
   - Required: No
   - Description: Display title for the track

3. **`color`** (Text)
   - Type: Text
   - Required: No
   - Description: Hex color code (e.g., "#4CAF50")
   - Default: Leave empty for random colors

### Sample Collection Items:

| audioFile | title | color |
|-----------|-------|-------|
| track1.mp3 | Ambient Soundscape | #4CAF50 |
| track2.mp3 | Nature Sounds | #2196F3 |
| track3.mp3 | Ocean Waves | #FF9800 |

---

## Quick Reference: JSON Format

The builder expects this exact format:

```json
[
  {
    "url": "https://static.wixstatic.com/media/your-audio-file.mp3",
    "title": "Your Track Title",
    "color": "#4CAF50"
  }
]
```

**Field Details:**
- **`url`** (required): Full URL to the audio file
- **`title`** (optional): Display name (defaults to filename if not provided)
- **`color`** (optional): Hex color code (defaults to random color if not provided)

---

## Troubleshooting

### URLs not working?
- Make sure audio files are uploaded to **Wix Media Manager**
- Use the **Copy Link** feature (don't manually construct URLs)
- URLs should start with `https://static.wixstatic.com/media/`

### JSON format errors?
- Make sure it's a valid JSON array `[...]`
- Each item must have `url` field
- Use double quotes `"` not single quotes `'`
- No trailing commas

### HTTP Function not working?
- Make sure you've published your site
- Check the function URL is correct
- Verify collection name matches in code
- Check browser console for CORS errors

### Can't access CMS?
- Make sure you're in **Editor** mode (not Preview)
- Check you have permission to access CMS
- Try refreshing the page

---

## Tips

1. **Batch Upload:** Upload all audio files to Wix Media first, then create CMS items
2. **Naming:** Use descriptive titles for easier management
3. **Colors:** Use a color picker to get hex codes (e.g., `#4CAF50`)
4. **Testing:** Test with 2-3 tracks first before adding many
5. **Backup:** Keep a copy of your JSON for easy re-import

---

## Example: Complete Workflow

1. **Upload Audio Files:**
   - Go to Wix Media Manager
   - Upload 5 audio files
   - Copy each file's link

2. **Create JSON:**
   ```json
   [
     {
       "url": "https://static.wixstatic.com/media/abc123-track1.mp3",
       "title": "Morning Birds",
       "color": "#4CAF50"
     },
     {
       "url": "https://static.wixstatic.com/media/def456-track2.mp3",
       "title": "Ocean Waves",
       "color": "#2196F3"
     },
     {
       "url": "https://static.wixstatic.com/media/ghi789-track3.mp3",
       "title": "Forest Ambience",
       "color": "#FF9800"
     },
     {
       "url": "https://static.wixstatic.com/media/jkl012-track4.mp3",
       "title": "Rain Sounds",
       "color": "#9C27B0"
     },
     {
       "url": "https://static.wixstatic.com/media/mno345-track5.mp3",
       "title": "City Traffic",
       "color": "#F44336"
     }
   ]
   ```

3. **Use in Builder:**
   - Open `builder.html`
   - Click "Load from Wix CMS"
   - Paste JSON
   - Click "Load from CMS Data"
   - Click canvas to place sources
   - Export configuration when done!

That's it! You now have your Wix CMS data in the builder. 🎵

