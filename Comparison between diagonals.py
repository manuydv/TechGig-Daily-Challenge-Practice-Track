

For this challenge, you need to take a matrix as an input from the stdin , calculate the sum of the digits for each diagonal and compare them.For example, 
in the below matrix 
1 2 3 
4 5 6 
7 8 9 
Diagonal 1 is 1,5,9. 
Diagonal 2 is 3,5,7. 

Input Format
A matrix is to be taken as input from stdin.On first line you need to tell that how many rows and columns your matrix need to have and these values should be separated by space.

Constraints
1 < (n,m) < 100

Output Format
If sum of digits for diagonal 1 is found to be greater than diagonal 2, then print 'Diagonal 1' to the stdout. If sum of digits for diagonal 2 is found to be greater than diagonal 1, then print 'Diagonal 2' to the stdout. If both of the diagonal found to be equal, then print 'Equal' to the stdout.

Sample TestCase 1

Input
3 3
2 3 4
1 4 6
7 8 9

dim = list(map(int, input().split()))
m = dim[0]
n = dim[1]


matrix1 = []

for i in range(m):
    matrix1.append(list(map(int, input().split())))

add1 = 0
add2 = 0
for i in range(m):
            add1 = add1 + matrix1[i][i]
            add2 = add2 + matrix1[i][m-i-1]
           
if add1 > add2:
    print('Diagonal 1', end = "")
elif add2 > add1:
    print('Diagonal 2', end = "")
elif add1 == add2:
    print('Equal', end = "")
