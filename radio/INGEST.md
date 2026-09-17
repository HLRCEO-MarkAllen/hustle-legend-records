# HLR Radio private media ingest

## Canonical source
The working source for the first-party radio conversion is the private Dropbox customer package:

`HLR_Born_2_Be_A_Legend_Digital_Download.zip`

The existing fulfillment SOP identifies it as the complete 20-track album in 320 kbps MP3 format.

## Security rule
Do **not** commit the customer ZIP, source WAVs, stems, project files, production masters, or sales-quality MP3s to the public website repository.

The repository contains only:
- station code
- metadata / catalog manifests
- source-adapter configuration
- a local conversion utility

## Conversion target
Use `tools/prepare_radio_media.py` against a private local copy of the ZIP to create lower-bitrate radio derivatives. The default target is 96 kbps MP3 so the radio copies are distinct from the 320 kbps direct-sale package.

Example:

```bash
python tools/prepare_radio_media.py \
  /private/HLR_Born_2_Be_A_Legend_Digital_Download.zip \
  /private/hlr-radio-media
```

The output names match `radio/catalog.json`.

## Activation
After the derived radio files are placed behind the HLR-controlled media endpoint `/radio-media/`, switch `directFeedEnabled` in `radio/config.json` to `true`.

The station engine automatically probes the selected track. When the direct file is available, it switches the UI to **HLR DIRECT** and hides the Spotify fallback. When it is not available, Spotify remains the temporary distributed-catalog fallback.

## Rights
Only audio that HLR is authorized to transmit should be placed into the direct radio feed. Third-party masters or compositions can carry separate public-performance and digital-transmission obligations.
