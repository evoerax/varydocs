const paths = {
  assistant: 'M3 5.5A2.5 2.5 0 0 1 5.5 3h13A2.5 2.5 0 0 1 21 5.5v9a2.5 2.5 0 0 1-2.5 2.5H10l-5.5 4v-4.4A2.5 2.5 0 0 1 3 14.4z M7.5 8h9 M7.5 12H14',
  close: 'm6 6 12 12 M18 6 6 18',
  newChat: 'M12 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h12a1.5 1.5 0 0 0 1.5-1.5v-6 M15.2 9.3l4.2-4.2 1.6 1.6-4.2 4.2-2.35.75z',
  docked: 'M5 4.5h14A1.5 1.5 0 0 1 20.5 6v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18V6A1.5 1.5 0 0 1 5 4.5z M14.5 4.5v15',
  floating: 'M9 8h10a1.5 1.5 0 0 1 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 18V9.5A1.5 1.5 0 0 1 9 8z M3.5 15V6A1.5 1.5 0 0 1 5 4.5h10',
  book: 'M12 6.1C10 4.2 6.4 3.9 3 4.6v13.5c3.4-.7 7-.4 9 1.5 2-1.9 5.6-2.2 9-1.5V4.6c-3.4-.7-7-.4-9 1.5z M12 6.1v13.5',
  arrow: 'M5 12h14 m-6-6 6 6-6 6',
  send: 'M12 19V5 m-6 6 6-6 6 6',
  stop: 'M6 6h12v12H6z',
  up: 'M8 10v10H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h4Zm0 0 4-7a2 2 0 0 1 2 2v4h5a2 2 0 0 1 2 2.4l-1.5 7A2 2 0 0 1 17.6 20H8',
  down: 'M8 14V4H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h4Zm0 0 4 7a2 2 0 0 0 2-2v-4h5a2 2 0 0 0 2-2.4l-1.5-7A2 2 0 0 0 17.6 4H8',
};

export function Icon({ name }: { name: keyof typeof paths }) {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d={paths[name]} />
  </svg>;
}
