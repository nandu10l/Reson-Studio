import React from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

function Home() {
  return (
    <div>
      <Navbar />
      <div className="home-container">
        <Sidebar />
        <main>
          <h1>Welcome to Reson Studio</h1>
          <p>Your creative audio workspace</p>
        </main>
      </div>
    </div>
  );
}

export default Home;