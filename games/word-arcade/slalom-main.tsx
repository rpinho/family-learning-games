// Letter Slalom's own light entry (the hub card opens /?play=slalom): only the slalom's code, never the Arcade shell.
import React from 'react';
import {createRoot} from 'react-dom/client';
import SlalomApp from './app/SlalomApp';
import './app/globals.css';
createRoot(document.getElementById('root')!).render(<SlalomApp/>);
