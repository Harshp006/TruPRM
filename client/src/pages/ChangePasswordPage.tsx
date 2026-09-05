import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function ChangePasswordPage() {
  const { token, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to change password');
      }

      await refreshUser();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: '50px', backgroundColor: '#e8e8e8', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '400px', backgroundColor: 'white', border: '2px solid #333', padding: '0' }}>
        
        <div style={{ backgroundColor: '#cc0000', color: 'white', padding: '10px', fontSize: '16px', fontWeight: 'bold', borderBottom: '2px solid #333' }}>
          Action Required: Change Password
        </div>
        
        <div style={{ padding: '20px' }}>
          <div style={{ marginBottom: '20px', fontSize: '13px', color: '#333' }}>
            <strong>System Notice:</strong> You must update your password before proceeding to the ERP modules.
          </div>

          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{ color: 'red', border: '1px solid red', padding: '8px', marginBottom: '15px', fontSize: '12px', backgroundColor: '#ffeeee' }}>
                Error: {error}
              </div>
            )}
            
            <table style={{ width: '100%', marginBottom: '15px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '8px 0', width: '40%', fontSize: '13px', fontWeight: 'bold' }}>New Password:</td>
                  <td style={{ padding: '8px 0' }}>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      style={{ width: '100%', border: '1px solid #999', padding: '4px', fontSize: '13px' }}
                    />
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 0', fontSize: '13px', fontWeight: 'bold' }}>Confirm Password:</td>
                  <td style={{ padding: '8px 0' }}>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      style={{ width: '100%', border: '1px solid #999', padding: '4px', fontSize: '13px' }}
                    />
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ borderTop: '1px solid #ccc', paddingTop: '15px', textAlign: 'right' }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  backgroundColor: '#e0e0e0',
                  border: '1px outset #999',
                  padding: '5px 15px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  color: 'black'
                }}
              >
                {loading ? 'Processing...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
