import React from 'react'
import { graphql, useStaticQuery } from 'gatsby'
import ReactMapGL, { Marker, NavigationControl, Popup } from 'react-map-gl'
import cx from '@macklinu/cx'
import moment from 'moment'
import { GetScheduleQuery } from '../../graphql-types'
import 'mapbox-gl/dist/mapbox-gl.css'

interface Coordinates {
  latitude: number
  longitude: number
}

const centerOfUnitedStates: Coordinates = {
  latitude: 39.8283,
  longitude: -98.5795,
}

const Dot: React.FC<{ className?: string; onClick(): void }> = ({
  className,
  onClick,
}) => (
  <div
    className={cx(
      'w-4 h-4 rounded-full shadow opacity-75 border border-blue-900 cursor-pointer',
      className
    )}
    onClick={onClick}
  />
)

const NavControls = () => (
  <div className='absolute bottom-0 right-0 p-3 mb-4'>
    <NavigationControl />
  </div>
)

type VenueName = string
const venueCoordinateLookup: Record<VenueName, Coordinates> = {
  'Globe Life Field': { latitude: 32.7474, longitude: -97.0842 },
}

interface State {
  viewport: any
  dates: any[]
  selectedDateIndex: number
  selectedGame: any | null
}

type Action =
  | { type: 'changeViewport'; viewport: any }
  | { type: 'selectDate'; date: string }
  | { type: 'increaseDate' }
  | { type: 'decreaseDate' }
  | { type: 'showPopup'; game: any }
  | { type: 'hidePopup' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'selectDate': {
      const selectedDateIndex = state.dates.findIndex(
        date => date.date === action.date
      )
      return { ...state, selectedDateIndex }
    }
    case 'increaseDate': {
      return {
        ...state,
        selectedDateIndex: Math.min(
          state.selectedDateIndex + 1,
          state.dates.length - 1
        ),
        selectedGame: null,
      }
    }
    case 'decreaseDate': {
      return {
        ...state,
        selectedDateIndex: Math.max(state.selectedDateIndex - 1, 0),
        selectedGame: null,
      }
    }
    case 'changeViewport': {
      return { ...state, viewport: action.viewport }
    }
    case 'showPopup': {
      return { ...state, selectedGame: action.game }
    }
    case 'hidePopup': {
      return { ...state, selectedGame: null }
    }
    default:
      return state
  }
}

const noop = () => {}

function useKeyUpListeners(listenerMap: Record<string, () => void>) {
  return React.useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const fn = listenerMap[e.key] ?? noop
      fn()
    }
    document.addEventListener('keyup', listener)
    return () => {
      document.removeEventListener('keyup', listener)
    }
  }, [listenerMap])
}

function coordinatesForGame(game: any): Coordinates {
  const { defaultCoordinates } = game.venue.location
  return defaultCoordinates ?? venueCoordinateLookup[game.venue.name]
}

const GamePopup: React.FC<{ onClose(): void; game: any }> = ({
  onClose,
  game,
}) => (
  <Popup
    anchor='top'
    closeOnClick
    closeButton
    onClose={onClose}
    {...coordinatesForGame(game)}
  >
    <div className='px-1'>
      <p>
        {game.teams.away.team.abbreviation} @{' '}
        {game.teams.home.team.abbreviation}{' '}
        {moment(game.gameDate)
          .local()
          .format('LT')}
      </p>
    </div>
  </Popup>
)

const Index: React.FC = () => {
  const data = useStaticQuery<GetScheduleQuery>(graphql`
    query GetSchedule {
      allDates(filter: { id: { ne: "dummy" } }) {
        nodes {
          id
          date
          games {
            gamePk
            gameDate
            venue {
              name
              location {
                city
                state
                defaultCoordinates {
                  latitude
                  longitude
                }
              }
            }
            teams {
              home {
                team {
                  name
                  abbreviation
                }
              }
              away {
                team {
                  name
                  abbreviation
                }
              }
            }
          }
        }
      }
    }
  `)

  const [state, dispatch] = React.useReducer(reducer, {
    selectedDateIndex: 0,
    dates: data.allDates.nodes,
    selectedGame: null,
    viewport: {
      zoom: 4,
      width: '100vw',
      height: '100vh',
      ...centerOfUnitedStates,
    },
  })

  const { games, date } = data.allDates.nodes[state.selectedDateIndex]

  useKeyUpListeners({
    ArrowLeft: () => dispatch({ type: 'decreaseDate' }),
    ArrowRight: () => dispatch({ type: 'increaseDate' }),
    Escape: () => dispatch({ type: 'hidePopup' }),
  })

  return (
    <div className='relative'>
      <ReactMapGL
        mapStyle='mapbox://styles/mapbox/light-v10'
        mapboxApiAccessToken={process.env.GATSBY_MAPBOX_ACCESS_TOKEN}
        {...state.viewport}
        onViewportChange={viewport =>
          dispatch({ type: 'changeViewport', viewport })
        }
        keyboard={false}
      >
        {(games ?? []).map((game: any) => {
          const coordinates = coordinatesForGame(game)
          return (
            <Marker
              key={game.venue.name}
              {...coordinates}
              offsetLeft={-5}
              offsetTop={-5}
            >
              <Dot
                className='bg-blue-700'
                onClick={() => dispatch({ type: 'showPopup', game })}
              />
            </Marker>
          )
        })}
        {state.selectedGame && (
          <GamePopup
            onClose={() => dispatch({ type: 'hidePopup' })}
            game={state.selectedGame}
          />
        )}
        <NavControls />
      </ReactMapGL>
      <div className='absolute bottom-0 left-0 ml-4 mb-8'>
        <div className='flex flex-row'>
          <select
            className='block appearance-none w-full bg-white border border-gray-400 hover:border-gray-500 px-4 py-2 rounded shadow leading-tight focus:outline-none focus:shadow-outline'
            value={date}
            onChange={e => {
              dispatch({ type: 'selectDate', date: e.target.value })
            }}
          >
            {data.allDates.nodes.map((node: any) => (
              <option key={node.date} value={node.date}>
                {moment(node.date).format('ddd M/D/YYYY')}
              </option>
            ))}
          </select>
          <div className='inline-flex ml-2'>
            <button
              className='bg-white border hover:border-gray-500 text-gray-800 font-bold py-2 px-4 rounded-l'
              onClick={() => dispatch({ type: 'decreaseDate' })}
            >
              Prev
            </button>
            <button
              className='bg-white border hover:border-gray-500 text-gray-800 font-bold py-2 px-4 rounded-r'
              onClick={() => dispatch({ type: 'increaseDate' })}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Index
