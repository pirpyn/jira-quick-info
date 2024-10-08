# Jira Quick Info

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/pierre-payen.jira-quick-info?label=VS%20Marketplace)![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/pierre-payen.jira-quick-info)![Visual Studio Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/pierre-payen.jira-quick-info)](https://marketplace.visualstudio.com/items?itemName=pierre-payen.jira-quick-info)

[![Open VSX Version](https://img.shields.io/open-vsx/v/pierre-payen/jira-quick-info?label=Open%20VSX)![Open VSX Downloads](https://img.shields.io/open-vsx/dt/pierre-payen/jira-quick-info)](https://open-vsx.org/extension/pierre-payen/jira-quick-info)

Small extension to display a Jira's summary, status and owner in the status bar.
Clicking on it will open the issue webpage.

![Example Image](example.png)

## Requirement
You'll need to set up a Personnal Access Token to authenticate to Jira.
Look for more information in your Jira's profile.

# Changelog

## [0.0.4] 2024-08-12
- Change extension kind to "ui" to download images next to the tooltip renderer
- Reload PAT on change of the corresponding option
- Added a new "Output" log tag, to print list of downloaded images and their location on disk
- Fix default issue name from the Workspace folder basename
