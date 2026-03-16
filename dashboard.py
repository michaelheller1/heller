import dash
from dash import dcc, html
import pandas as pd
import plotly.express as px

# Load Titanic dataset
url = "https://raw.githubusercontent.com/datasciencedojo/datasets/master/titanic.csv"
df = pd.read_csv(url)

app = dash.Dash(__name__)

# Survival pie chart
survived_fig = px.pie(df, names='Survived', title='Survival Proportion',
                      labels={0: 'Did Not Survive', 1: 'Survived'},
                      hole=0.4)

# Age distribution
age_fig = px.histogram(df, x="Age", color="Survived", nbins=30, barmode='overlay',
                       title="Age Distribution by Survival",
                       labels={'Survived': 'Survived (1) or Not (0)'})

# Fare by class boxplot
fare_fig = px.box(df, x="Pclass", y="Fare", color="Pclass",
                  title="Fare Distribution by Passenger Class")

app.layout = html.Div([
    html.H1("Titanic Dataset Dashboard"),
    html.Div([
        html.Div([
            dcc.Graph(figure=survived_fig)
        ], style={'width': '32%', 'display': 'inline-block'}),
        html.Div([
            dcc.Graph(figure=age_fig)
        ], style={'width': '32%', 'display': 'inline-block'}),
        html.Div([
            dcc.Graph(figure=fare_fig)
        ], style={'width': '32%', 'display': 'inline-block'})
    ]),
    html.H3("Raw Data (First 10 Rows)"),
    html.Table([
        html.Thead(html.Tr([html.Th(col) for col in df.columns])),
        html.Tbody([
            html.Tr([
                html.Td(df.iloc[i][col]) for col in df.columns
            ]) for i in range(min(10, len(df)))
        ])
    ]),
])

if __name__ == '__main__':
    app.run_server(debug=True)