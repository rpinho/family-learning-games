#!/usr/bin/env python3
"""Same SMTP channel as the personal Morning Digest. Configuration stays private."""
import json, os, smtplib, sys
from pathlib import Path
from email.message import EmailMessage
payload = json.load(sys.stdin)
address = os.environ.get('BOOK_NOTICE_ADDRESS')
if not address:
    # Read the channel's configured address rather than publishing a household address in source.
    import runpy
    address = runpy.run_path(str(Path.home() / 'personal-kb/scripts/send-digest.py'))['ADDR']
pw = (Path.home() / '.config/claude-nightly/gmail-app-password').read_text().strip()
msg = EmailMessage()
msg['From'] = msg['To'] = address
msg['Subject'] = payload['subject']
msg.set_content(payload['body'])
with smtplib.SMTP('smtp.gmail.com', 587, timeout=30) as smtp:
    smtp.starttls()
    smtp.login(address, pw)
    smtp.send_message(msg)
print('Book notice sent via SMTP')
