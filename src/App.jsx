import { useState, useEffect } from 'react'
import './App.css'

const EXERCISES = [
  'Bankdrücken',
  'Brustpresse',
  'Flys',
  'Latzug',
  'Rudern',
  'Bizeps Curls',
  'Trizeps Curls'
]

function App() {
  const [workouts, setWorkouts] = useState(() => {
    const saved = localStorage.getItem('fitness-workouts')
    return saved ? JSON.parse(saved) : []
  })
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedExercise, setSelectedExercise] = useState(EXERCISES[0])
  const [sets, setSets] = useState([{ weight: '', reps: '' }])
  const [view, setView] = useState('add')

  useEffect(() => {
    localStorage.setItem('fitness-workouts', JSON.stringify(workouts))
  }, [workouts])

  const addSet = () => {
    setSets([...sets, { weight: '', reps: '' }])
  }

  const removeSet = (index) => {
    if (sets.length > 1) {
      setSets(sets.filter((_, i) => i !== index))
    }
  }

  const updateSet = (index, field, value) => {
    const newSets = [...sets]
    newSets[index][field] = value
    setSets(newSets)
  }

  const saveWorkout = () => {
    const validSets = sets.filter(s => s.weight && s.reps)
    if (validSets.length === 0) {
      alert('Bitte mindestens einen Satz mit Gewicht und Wiederholungen eingeben!')
      return
    }

    const newEntry = {
      id: Date.now(),
      date: currentDate,
      exercise: selectedExercise,
      sets: validSets.map(s => ({
        weight: parseFloat(s.weight),
        reps: parseInt(s.reps)
      }))
    }

    setWorkouts([...workouts, newEntry])
    setSets([{ weight: '', reps: '' }])
    alert('Training gespeichert!')
  }

  const deleteWorkout = (id) => {
    if (confirm('Diesen Eintrag wirklich löschen?')) {
      setWorkouts(workouts.filter(w => w.id !== id))
    }
  }

  const groupedWorkouts = workouts.reduce((acc, workout) => {
    if (!acc[workout.date]) {
      acc[workout.date] = []
    }
    acc[workout.date].push(workout)
    return acc
  }, {})

  const sortedDates = Object.keys(groupedWorkouts).sort((a, b) => new Date(b) - new Date(a))

  return (
    <div className="app">
      <h1>Fitness Tracker</h1>

      <div className="nav-tabs">
        <button
          className={view === 'add' ? 'active' : ''}
          onClick={() => setView('add')}
        >
          Training eintragen
        </button>
        <button
          className={view === 'history' ? 'active' : ''}
          onClick={() => setView('history')}
        >
          Verlauf
        </button>
      </div>

      {view === 'add' && (
        <div className="add-workout">
          <div className="form-group">
            <label>Datum:</label>
            <input
              type="date"
              value={currentDate}
              onChange={(e) => setCurrentDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Übung:</label>
            <select
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
            >
              {EXERCISES.map(ex => (
                <option key={ex} value={ex}>{ex}</option>
              ))}
            </select>
          </div>

          <div className="sets-container">
            <h3>Sätze</h3>
            {sets.map((set, index) => (
              <div key={index} className="set-row">
                <span className="set-number">Satz {index + 1}:</span>
                <input
                  type="number"
                  placeholder="Gewicht (kg)"
                  value={set.weight}
                  onChange={(e) => updateSet(index, 'weight', e.target.value)}
                  min="0"
                  step="0.5"
                />
                <input
                  type="number"
                  placeholder="Wdh"
                  value={set.reps}
                  onChange={(e) => updateSet(index, 'reps', e.target.value)}
                  min="0"
                />
                <button
                  className="remove-btn"
                  onClick={() => removeSet(index)}
                  disabled={sets.length === 1}
                >
                  X
                </button>
              </div>
            ))}
            <button className="add-set-btn" onClick={addSet}>+ Satz hinzufügen</button>
          </div>

          <button className="save-btn" onClick={saveWorkout}>Training speichern</button>
        </div>
      )}

      {view === 'history' && (
        <div className="history">
          {sortedDates.length === 0 ? (
            <p className="no-data">Noch keine Trainings eingetragen.</p>
          ) : (
            sortedDates.map(date => {
              const dayWorkouts = groupedWorkouts[date]
              const maxSets = Math.max(...dayWorkouts.map(w => w.sets.length))

              return (
                <div key={date} className="workout-day">
                  <h3>{new Date(date).toLocaleDateString('de-DE', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}</h3>
                  <div className="workout-table-container">
                    <table className="workout-table">
                      <thead>
                        <tr>
                          <th>Übung</th>
                          {[...Array(maxSets)].map((_, i) => (
                            <th key={i}>Satz {i + 1}</th>
                          ))}
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayWorkouts.map(workout => (
                          <tr key={workout.id}>
                            <td className="exercise-name">{workout.exercise}</td>
                            {[...Array(maxSets)].map((_, i) => (
                              <td key={i} className="set-cell">
                                {workout.sets[i] ? (
                                  <span className="set-data">
                                    <span className="weight">{workout.sets[i].weight}kg</span>
                                    <span className="reps">×{workout.sets[i].reps}</span>
                                  </span>
                                ) : (
                                  <span className="empty-set">–</span>
                                )}
                              </td>
                            ))}
                            <td className="action-cell">
                              <button
                                className="delete-btn-small"
                                onClick={() => deleteWorkout(workout.id)}
                                title="Löschen"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

export default App
