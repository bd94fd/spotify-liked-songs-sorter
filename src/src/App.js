import React, { useState, useEffect } from 'react';
import { CLIENT_ID, REDIRECT_URI, SCOPES } from './config';

function App() {
  const [token, setToken] = useState('');
  const [likedSongs, setLikedSongs] = useState([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const hash = window.location.hash;
    let tokenFromUrl = '';
    if (hash) {
      tokenFromUrl = hash
        .substring(1)
        .split('&')
        .find(elem => elem.startsWith('access_token'))
        ?.split('=')[1];
      window.history.pushState('', document.title, window.location.pathname);
      setToken(tokenFromUrl);
    }
  }, []);

  const loginUrl = `${'https://accounts.spotify.com/authorize'}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&scope=${SCOPES.join('%20')}&response_type=token&show_dialog=true`;

  const fetchLikedSongs = async () => {
    setStatus('Fetching liked songs...');
    let allSongs = [];
    let url = 'https://api.spotify.com/v1/me/tracks?limit=50';
    while (url) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setStatus('Error fetching liked songs');
        return;
      }
      const data = await res.json();
      allSongs = allSongs.concat(data.items);
      url = data.next;
    }
    setLikedSongs(allSongs);
    setStatus(`Fetched ${allSongs.length} liked songs`);
    await createMonthlyPlaylistsAndAddSongs(allSongs);
  };

  const createMonthlyPlaylistsAndAddSongs = async allSongs => {
    setStatus('Getting user info...');
    const userRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!userRes.ok) {
      setStatus('Error fetching user info');
      return;
    }
    const userData = await userRes.json();
    const userId = userData.id;

    const groups = {};
    allSongs.forEach(({ added_at, track }) => {
      const date = new Date(added_at);
      const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!groups[monthYear]) groups[monthYear] = [];
      groups[monthYear].push(track.uri);
    });

    setStatus('Fetching user playlists...');
    let playlists = [];
    let url = `https://api.spotify.com/v1/me/playlists?limit=50`;
    while (url) {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        setStatus('Error fetching playlists');
        return;
      }
      const data = await res.json();
      playlists = playlists.concat(data.items);
      url = data.next;
    }

    for (const monthYear of Object.keys(groups)) {
      setStatus(`Processing playlist for ${monthYear}...`);

      let playlist = playlists.find(p => p.name === `Liked Songs ${monthYear}`);
      if (!playlist) {
        const createRes = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: `Liked Songs ${monthYear}`,
            description: `Songs liked in ${monthYear}`,
            public: false,
          }),
        });
        if (!createRes.ok) {
          setStatus(`Error creating playlist ${monthYear}`);
          return;
        }
        playlist = await createRes.json();
        playlists.push(playlist);
      }

      const uris = groups[monthYear];
      for (let i = 0; i < uris.length; i += 100) {
        const batch = uris.slice(i, i + 100);
        const addRes = await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ uris: batch }),
        });
        if (!addRes.ok) {
          setStatus(`Error adding tracks to ${monthYear}`);
          return;
        }
      }
    }
    setStatus('All done! Your liked songs are sorted into monthly playlists.');
  };

  return (
    <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h2>Spotify Monthly Liked Songs Sorter</h2>
      {!token ? (
        <a href={loginUrl}>
          <button style={{ padding: '10px 20px', fontSize: 16 }}>Log in with Spotify</button>
        </a>
      ) : (
        <>
          <button onClick={fetchLikedSongs} style={{ padding: '10px 20px', fontSize: 16 }}>
            Sort My Liked Songs
          </button>
          <p>{status}</p>
          <p>{likedSongs.length} songs fetched.</p>
        </>
      )}
    </div>
  );
}

export default App;
        
