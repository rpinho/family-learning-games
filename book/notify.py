#!/usr/bin/env python3
"""Optional SMTP notices. Configuration stays outside the repository."""
import json, os, smtplib, sys
from pathlib import Path
from email.message import EmailMessage
from notice_payload import read_payload
payload = read_payload(sys.argv[1:], sys.stdin)
address = os.environ.get('BOOK_NOTICE_ADDRESS')
password_file = os.environ.get('BOOK_NOTICE_PASSWORD_FILE')
if not address or not password_file:
    raise SystemExit('Configure the notice address and password file before sending notices.')
pw = Path(password_file).read_text().strip()
msg = EmailMessage()
msg['From'] = msg['To'] = address
msg['Subject'] = payload['subject']
msg.set_content(payload['body'])
with smtplib.SMTP('smtp.gmail.com', 587, timeout=30) as smtp:
    smtp.starttls()
    smtp.login(address, pw)
    smtp.send_message(msg)
print('Book notice sent via SMTP')
