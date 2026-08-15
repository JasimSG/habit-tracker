import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Log = {
  value: string;
  log_date: string;
};

type Habit = {
  id: number;
  name: string;
  target: number;
  logs: Log[];
};

const USER_ID = 1;

// Convert Date to YYYY-MM-DD format
function dateKey(date: Date): string {
  return date.toLocaleDateString('en-CA');
}

// Get the last 7 days including today
function last7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date();

    date.setDate(
      date.getDate() - (6 - i)
    );

    return dateKey(date);
  });
}

// Calculate habit completion rate for the last 7 days
function completionRate(habit: Habit): number {
  const days = last7Days();

  const completedDays = days.filter((day) =>
    habit.logs.some((log) =>
      log.log_date.startsWith(day)
    )
  ).length;

  return Math.round(
    (completedDays / 7) * 100
  );
}

// Calculate the current consecutive-day streak
function streak(habit: Habit): number {
  const loggedDays = new Set(
    habit.logs.map((log) =>
      log.log_date.slice(0, 10)
    )
  );

  let count = 0;
  const date = new Date();

  while (loggedDays.has(dateKey(date))) {
    count++;

    date.setDate(
      date.getDate() - 1
    );
  }

  return count;
}

// Generic API request helper
async function request<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(
    url,
    options
  );

  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      body.reason ||
        body.error ||
        'Request failed'
    );
  }

  return body;
}

function App() {
  const [habits, setHabits] =
    useState<Habit[]>([]);

  const [search, setSearch] =
    useState('');

  const [newHabit, setNewHabit] =
    useState('');

  const [error, setError] =
    useState('');

  // Calculate the last 7 days
  const days = useMemo(
    () => last7Days(),
    []
  );

  // Load habits from backend
  const load = async (): Promise<void> => {
    const data = await request<Habit[]>(
      `/api/dashboard?userId=${USER_ID}`
    );

    setHabits(data);
  };

  // Load data when component mounts
  useEffect(() => {
    load().catch((error: Error) => {
      setError(error.message);
    });
  }, []);

  // Filter habits based on search text
  const filtered = habits.filter(
    (habit) =>
      habit.name
        .toLowerCase()
        .includes(
          search.toLowerCase()
        )
  );

  // Calculate average completion rate
  const totalRate = habits.length
    ? Math.round(
        habits.reduce(
          (sum, habit) =>
            sum +
            completionRate(habit),
          0
        ) / habits.length
      )
    : 0;

  // Add a new habit
  async function addHabit(
    event: React.FormEvent
  ): Promise<void> {
    event.preventDefault();

    if (!newHabit.trim()) {
      return;
    }

    try {
      await request('/api/habits', {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          userId: USER_ID,
          name: newHabit.trim(),
          target: 1,
        }),
      });

      setNewHabit('');
      setError('');

      await load();
    } catch (error) {
      setError(
        (error as Error).message
      );
    }
  }

  // Log today's habit
  async function logHabit(
    id: number
  ): Promise<void> {
    try {
      await request('/api/logs', {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          userId: USER_ID,
          habitId: id,
          value: 'done',
        }),
      });

      setError('');

      await load();
    } catch (error) {
      setError(
        (error as Error).message
      );
    }
  }

  return (
    <main className="page">

      <header>
        <div>
          <p className="eyebrow">
            HEALTH TRACKER
          </p>

          <h1>
            My habits
          </h1>

          <p className="muted">
            Build consistency one day
            at a time.
          </p>
        </div>

        <div className="summary">
          <strong>
            {totalRate}%
          </strong>

          <span>
            weekly average
          </span>
        </div>
      </header>

      <section className="toolbar">

        <input
          aria-label="Search habits"
          placeholder="Search habits"
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
        />

        <form onSubmit={addHabit}>

          <input
            placeholder="New habit"
            value={newHabit}
            onChange={(event) =>
              setNewHabit(
                event.target.value
              )
            }
          />

          <button type="submit">
            Add
          </button>

        </form>

      </section>

      {error && (
        <div
          className="error"
          role="alert"
        >
          {error}
        </div>
      )}

      <section className="grid">

        {filtered.map((habit) => (

          <article
            className="card"
            key={habit.id}
          >

            <div className="cardTop">

              <div>

                <h2>
                  {habit.name}
                </h2>

                <p className="muted">
                  {streak(habit)} day
                  streak
                </p>

              </div>

              <div className="rate">
                {completionRate(
                  habit
                )}
                %
              </div>

            </div>

            <div className="week">

              {days.map((day) => {

                const completed =
                  habit.logs.some(
                    (log) =>
                      log.log_date.startsWith(
                        day
                      )
                  );

                return (
                  <div
                    className="day"
                    key={day}
                  >

                    <span>
                      {new Date(
                        `${day}T12:00:00`
                      ).toLocaleDateString(
                        undefined,
                        {
                          weekday:
                            'short',
                        }
                      )}
                    </span>

                    <i
                      className={
                        completed
                          ? 'done'
                          : ''
                      }
                    />

                  </div>
                );
              })}

            </div>

            <button
              className="log"
              onClick={() =>
                logHabit(
                  habit.id
                )
              }
              disabled={habit.logs.some(
                (log) =>
                  log.log_date.startsWith(
                    dateKey(
                      new Date()
                    )
                  )
              )}
            >
              Log today
            </button>

          </article>

        ))}

      </section>

      {!filtered.length && (
        <div className="empty">
          No habits found.
        </div>
      )}

    </main>
  );
}

const rootElement =
  document.getElementById('root');

if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}